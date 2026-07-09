import { Result, ok, fail } from '@/shared/kernel/Result'
import { EntityRegistry } from '@/contexts/costing/application/ports/out/EntityRegistry'
import { RecordStore, RecordRow } from '@/contexts/costing/application/ports/out/RecordStore'
import { ExplodirFicha, ExplodirFichaCommand, ExplosaoResumo } from '@/contexts/costing/application/ports/in/ExplodirFicha'
import { explodeFicha, FichaLineInput, SkuVariacao, Substituicao } from '@/contexts/costing/domain/Explosion'
import { CostingError } from '@/contexts/costing/domain/CostingError'

const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0)) || 0
const parseMap = (v: unknown): Record<string, number> => {
  if (v == null || v === '') return {}
  try { const o = typeof v === 'string' ? JSON.parse(v) : v; return o && typeof o === 'object' ? (o as Record<string, number>) : {} }
  catch { return {} }
}

export class ExplodirFichaService implements ExplodirFicha {
  constructor(private readonly store: RecordStore, private readonly registry: EntityRegistry) {}

  async execute(cmd: ExplodirFichaCommand): Promise<Result<ExplosaoResumo>> {
    const ids = await this.resolveEntities()
    if (!ids) return fail(CostingError.entidadeFaltando)

    const sku = await this.store.get(cmd.skuId)
    if (!sku) return fail(CostingError.skuNotFound)
    const modeloId = String(sku.data.modelo ?? '')
    if (!modeloId) return fail(CostingError.skuSemModelo)
    const variacaoIds = (Array.isArray(sku.data.variacoes) ? sku.data.variacoes : []).map(String)

    // ficha lines of the modelo, latest published rev
    const fichaRows = await this.store.query(ids.fichas_tecnicas, [
      { field: 'modelo', op: 'eq', value: modeloId },
      { field: 'status', op: 'eq', value: 'publicada' },
    ])
    if (fichaRows.length === 0) return fail(CostingError.semFichaPublicada)
    const maxRev = Math.max(...fichaRows.map((r) => num(r.data.rev)))
    const lines: FichaLineInput[] = []

    // load the item Produtos referenced by the ficha (for fantasma flag + cost)
    const fichaItemIds = fichaRows.filter((r) => num(r.data.rev) === maxRev).map((r) => String(r.data.item))
    const subs = await this.loadSubs(ids.substituicoes, variacaoIds)
    const paraIds = subs.map((s) => s.paraItemId)
    const produtos = await this.byId(ids.produtos, [...new Set([...fichaItemIds, ...paraIds])])

    for (const r of fichaRows.filter((r) => num(r.data.rev) === maxRev)) {
      const itemId = String(r.data.item)
      lines.push({
        itemId,
        isFantasma: produtos.get(itemId)?.data.fantasma === true,
        unidade: String(r.data.unidade ?? ''),
        qtyBase: num(r.data.qty_base),
        qtyPorTamanho: parseMap(r.data.qty_por_tamanho),
      })
    }

    const skuVariacoes = await this.loadVariacoes(ids.variacoes, variacaoIds)
    const custos: Record<string, number | null> = {}
    for (const [id, p] of produtos) custos[id] = p.data.preco_custo == null ? null : num(p.data.preco_custo)

    const result = explodeFicha({ lines, skuVariacoes, substituicoes: subs, custos })

    // delete stale exploded lines, preserving editado_manual ones (unless forcar)
    const existing = await this.store.query(ids.fichas_explodidas, [{ field: 'sku', op: 'eq', value: cmd.skuId }])
    const manuais = existing.filter((r) => r.data.editado_manual === true)
    const toDelete = cmd.forcar ? existing : existing.filter((r) => r.data.editado_manual !== true)
    for (const r of toDelete) await this.store.delete(r.id)

    // a preserved manual line OVERRIDES the fresh recompute for that same item
    const manualItemIds = new Set((cmd.forcar ? [] : manuais).map((r) => String(r.data.item)))

    // write fresh exploded lines, skipping items already covered by a preserved manual row
    let custoFreshInserted = 0
    let linhasInseridas = 0
    for (const line of result.lines) {
      if (!cmd.forcar && manualItemIds.has(line.itemIdResolvido)) continue
      await this.store.insert(ids.fichas_explodidas, {
        sku: cmd.skuId, item: line.itemIdResolvido, qty: line.qty,
        custo_unit: line.custoUnit, custo_total: line.custoTotal, origem_rev: maxRev, editado_manual: false,
      })
      custoFreshInserted += line.custoTotal
      linhasInseridas++
    }
    const manuaisPreservados = cmd.forcar ? 0 : manuais.length

    // update the SKU cost (fresh inserted + preserved manual costs) + write a snapshot
    const custoManuais = (cmd.forcar ? [] : manuais).reduce((s, r) => s + num(r.data.custo_total), 0)
    const custoTotalFinal = custoFreshInserted + custoManuais
    await this.store.update(cmd.skuId, { ...sku.data, preco_custo: custoTotalFinal }, sku.version)
    await this.store.insert(ids.snapshots_custo, {
      sku: cmd.skuId, data: new Date().toISOString(), custo_total: custoTotalFinal, origem_rev: maxRev,
      detalhe: JSON.stringify(result.lines),
    })

    return ok({ skuId: cmd.skuId, custoTotal: custoTotalFinal, linhas: linhasInseridas + manuaisPreservados, erros: result.erros, manuaisPreservados })
  }

  private async resolveEntities() {
    const slugs = ['produtos', 'modelos', 'variacoes', 'fichas_tecnicas', 'substituicoes', 'fichas_explodidas', 'snapshots_custo'] as const
    const out = {} as Record<(typeof slugs)[number], string>
    for (const s of slugs) {
      const id = await this.registry.entityIdBySlug(s)
      if (!id) return null
      out[s] = id
    }
    return out
  }
  private async loadSubs(entityId: string, variacaoIds: string[]): Promise<Substituicao[]> {
    if (variacaoIds.length === 0) return []
    const rows = await this.store.query(entityId, [{ field: 'variacao', op: 'in', values: variacaoIds }])
    return rows.map((r) => ({ variacaoId: String(r.data.variacao), deItemId: String(r.data.de_item), paraItemId: String(r.data.para_item) }))
  }
  private async loadVariacoes(entityId: string, ids: string[]): Promise<SkuVariacao[]> {
    if (ids.length === 0) return []
    const rows = await this.store.query(entityId, [{ field: 'id', op: 'in', values: ids }])
    return rows.map((r) => ({ id: r.id, fatorQtd: r.data.fator_qtd == null ? null : num(r.data.fator_qtd) }))
  }
  private async byId(entityId: string, ids: string[]): Promise<Map<string, RecordRow>> {
    const rows = ids.length ? await this.store.query(entityId, [{ field: 'id', op: 'in', values: ids }]) : []
    return new Map(rows.map((r) => [r.id, r]))
  }
}
