import { Result, fail, ok } from '@/shared/kernel/Result'
import { JsonObject } from '@/shared/domain/Json'
import { SyncBlingMirror, SyncBlingMirrorCommand, SyncSummary } from '@/contexts/bling/application/ports/in/SyncBlingMirror'
import { BlingSyncClient } from '@/contexts/bling/application/ports/out/BlingSyncClient'
import { RecordSink } from '@/contexts/bling/application/ports/out/RecordSink'
import { BlingSyncMapPort } from '@/contexts/bling/application/ports/out/BlingSyncMapPort'
import { ResolveOwner } from '@/contexts/bling/application/ports/out/ResolveOwner'
import { SeedBlingEntitiesService } from '@/contexts/bling/application/use-cases/SeedBlingEntitiesService'
import { FkCache } from '@/contexts/bling/application/mirror/FkCache'
import { BLING_ENTITIES, BlingEntityDef } from '@/contexts/bling/domain/mirror/BlingEntitySchema'
import { MappedRecord, MappedValue, isRelRef } from '@/contexts/bling/domain/mirror/MappedRecord'
import { mapCategoria } from '@/contexts/bling/domain/mirror/mappers/categorias'
import { mapDeposito } from '@/contexts/bling/domain/mirror/mappers/depositos'
import { mapFormaPagamento } from '@/contexts/bling/domain/mirror/mappers/formasPagamento'
import { mapTipoContato } from '@/contexts/bling/domain/mirror/mappers/tiposContato'
import { mapContato } from '@/contexts/bling/domain/mirror/mappers/contatos'
import { mapProduto } from '@/contexts/bling/domain/mirror/mappers/produtos'
import { mapPedidoVenda } from '@/contexts/bling/domain/mirror/mappers/pedidosVendas'
import {
  BlingCategoriaProduto,
  BlingContatoFull,
  BlingContatoListItem,
  BlingDeposito,
  BlingFormaPagamento,
  BlingListResponse,
  BlingPedidoVendaFull,
  BlingPedidoVendaListItem,
  BlingProdutoFull,
  BlingProdutoListItem,
  BlingSingleResponse,
  BlingTipoContato,
} from '@/contexts/bling/domain/mirror/BlingApiTypes'

type EntityTally = SyncSummary['entities'][number]

export interface SyncBlingMirrorDeps {
  seed: SeedBlingEntitiesService
  client: BlingSyncClient
  recordSink: RecordSink
  syncMap: BlingSyncMapPort
  resolveOwner: ResolveOwner
  makeFk: () => FkCache
}

// Application service. Orchestrates the full Bling mirror import: resolve the
// owner, idempotently seed the 17 mirror entities, hydrate the FkCache from the
// persisted sync map, then import tier by tier (Tier1 catalogs -> Tier2
// contatos -> Tier3 produtos -> Tier4 pedidos), resolving each mapper's RelRef
// markers through the FkCache and upserting via RecordSink. A record with an
// unresolved REQUIRED relation is skipped rather than written with a dangling
// null (ports the old importer's "skip when the FK target isn't resolvable"
// behavior -- e.g. a kit componente pointing at a not-yet-imported produto, an
// orphan tipo in the contato/tipo junction). Non-required relations resolving
// to null are written as-is (e.g. a categoria without a parent yet).
export class SyncBlingMirrorService implements SyncBlingMirror {
  private readonly seed: SeedBlingEntitiesService
  private readonly client: BlingSyncClient
  private readonly recordSink: RecordSink
  private readonly syncMap: BlingSyncMapPort
  private readonly resolveOwner: ResolveOwner
  private readonly makeFk: () => FkCache

  constructor(deps: SyncBlingMirrorDeps) {
    this.seed = deps.seed
    this.client = deps.client
    this.recordSink = deps.recordSink
    this.syncMap = deps.syncMap
    this.resolveOwner = deps.resolveOwner
    this.makeFk = deps.makeFk
  }

  async execute(cmd: SyncBlingMirrorCommand): Promise<Result<SyncSummary>> {
    const ownerId = await this.resolveOwner.ownerId()
    if (!ownerId) {
      return fail('Bling não conectado: nenhum proprietário disponível para atribuir a sincronização.')
    }

    const seeded = await this.seed.execute(ownerId)
    if (!seeded.ok) return fail(seeded.error)
    const slugToId = seeded.value

    const fk = this.makeFk()
    fk.hydrateFrom(await this.syncMap.listAll())

    const tallies = new Map<string, EntityTally>()
    for (const def of BLING_ENTITIES) {
      tallies.set(def.slug, { slug: def.slug, inserted: 0, updated: 0, skipped: 0, errors: 0 })
    }
    const entityBySlug = new Map<string, BlingEntityDef>(BLING_ENTITIES.map((d) => [d.slug, d]))

    // Replace every RelRef marker in a mapped record's data with the resolved
    // AEX recordId (or null when the target hasn't been imported yet).
    const resolveRefs = (data: Record<string, MappedValue>): JsonObject => {
      const out: JsonObject = {}
      for (const [key, value] of Object.entries(data)) {
        out[key] = isRelRef(value) ? fk.lookup(value.slug, value.externalId) : value
      }
      return out
    }

    // Resolve + upsert a single mapped record, tallying the outcome against
    // the tally for its own slug.
    const sink = async (mapped: MappedRecord): Promise<void> => {
      const tally = tallies.get(mapped.slug)
      if (!tally) return
      const entityId = slugToId.get(mapped.slug)
      if (!entityId) {
        tally.errors++
        console.error(`[bling] sync: no entityId for slug ${mapped.slug}`)
        return
      }

      const resolvedData = resolveRefs(mapped.data)

      // Required-relation skip rule: an unresolved (still-null) REQUIRED
      // relation means the target hasn't been imported yet -- skip this
      // record instead of writing it with a dangling required FK.
      const def = entityBySlug.get(mapped.slug)
      if (def) {
        for (const field of def.fields) {
          if (field.type.kind === 'relation' && field.required === true && resolvedData[field.name] === null) {
            tally.skipped++
            return
          }
        }
      }

      const res = await this.recordSink.upsertExternal({
        entityId,
        slug: mapped.slug,
        externalId: mapped.externalId,
        data: resolvedData,
        createdBy: ownerId,
      })
      if (!res.ok) {
        tally.errors++
        console.error(`[bling] sync: upsert failed for ${mapped.slug}:${mapped.externalId}: ${res.error}`)
        return
      }

      fk.set(mapped.slug, mapped.externalId, res.value.recordId)
      if (res.value.inserted) tally.inserted++
      else if (res.value.changed) tally.updated++
      else tally.skipped++
    }

    // Wrap one entity's import loop so a fetch failure for it never aborts
    // the whole run -- log, tally an error against that entity, move on.
    const guarded = async (slug: string, run: () => Promise<void>): Promise<void> => {
      try {
        await run()
      } catch (err) {
        const tally = tallies.get(slug)
        if (tally) tally.errors++
        console.error(`[bling] sync: ${slug} import failed:`, err)
      }
    }

    const importCatalogPaginated = <T>(path: string, mapFn: (raw: T) => MappedRecord, slug: string) =>
      guarded(slug, async () => {
        for await (const raw of this.client.paginate<T>(path)) {
          await sink(mapFn(raw))
        }
      })

    // Categorias: buffer every raw row, sync pass 1 in list order (a parent
    // may not be resolvable yet if it's listed after its child), then re-sync
    // pass 2 for every row that declares a parent -- by then every parent has
    // been synced at least once, so the relation resolves. RecordSink's
    // content-hash makes pass 2 a no-op update for rows that already resolved.
    const importCategorias = () =>
      guarded('bling_categorias_produtos', async () => {
        const raws: BlingCategoriaProduto[] = []
        for await (const raw of this.client.paginate<BlingCategoriaProduto>('/categorias/produtos')) raws.push(raw)
        for (const raw of raws) await sink(mapCategoria(raw))
        for (const raw of raws) if (raw.categoriaPai) await sink(mapCategoria(raw))
      })

    const importTipos = () =>
      guarded('bling_tipos_contato', async () => {
        const res = await this.client.get<BlingListResponse<BlingTipoContato>>('/contatos/tipos')
        for (const raw of res.data ?? []) await sink(mapTipoContato(raw))
      })

    // Detail entities: paginate the list endpoint, fetch each item's full
    // record, run it through its (possibly multi-record) mapper. `limit` caps
    // the number of detail fetches for smoke runs.
    const importDetail = <TItem extends { id: number | string }, TFull>(
      listPath: string,
      mapFn: (full: TFull) => MappedRecord[],
      primarySlug: string,
      limit?: number,
    ) =>
      guarded(primarySlug, async () => {
        let count = 0
        for await (const item of this.client.paginate<TItem>(listPath)) {
          if (limit && count >= limit) break
          count++
          // Per-record guard: one item's detail fetch/map failing must not
          // abort the rest of the tier -- tally an error against this entity
          // and move on to the next item. The outer `guarded()` above still
          // catches a failure in the pagination itself (the list fetch).
          try {
            const full = (await this.client.get<BlingSingleResponse<TFull>>(`${listPath}/${item.id}`)).data
            for (const m of mapFn(full)) await sink(m)
          } catch (err) {
            const tally = tallies.get(primarySlug)
            if (tally) tally.errors++
            console.error(`[bling] sync: ${primarySlug} detail import failed for id ${item.id}:`, err)
          }
        }
      })

    if (cmd.scope === 'categorias') {
      await importCategorias()
    } else {
      await importCategorias()
      await importCatalogPaginated<BlingDeposito>('/depositos', mapDeposito, 'bling_depositos')
      await importCatalogPaginated<BlingFormaPagamento>('/formas-pagamentos', mapFormaPagamento, 'bling_formas_pagamento')
      await importTipos()
      await importDetail<BlingContatoListItem, BlingContatoFull>('/contatos', mapContato, 'bling_contatos', cmd.limit)
      await importDetail<BlingProdutoListItem, BlingProdutoFull>('/produtos', mapProduto, 'bling_produtos', cmd.limit)
      await importDetail<BlingPedidoVendaListItem, BlingPedidoVendaFull>(
        '/pedidos/vendas',
        mapPedidoVenda,
        'bling_pedidos_venda',
        cmd.limit,
      )
    }

    return ok({ entities: [...tallies.values()] })
  }
}
