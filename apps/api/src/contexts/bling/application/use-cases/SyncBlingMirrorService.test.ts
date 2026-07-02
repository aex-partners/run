import { describe, it, expect } from 'vitest'
import { SyncBlingMirrorService } from '@/contexts/bling/application/use-cases/SyncBlingMirrorService'
import { SeedBlingEntitiesService } from '@/contexts/bling/application/use-cases/SeedBlingEntitiesService'
import { FkCache } from '@/contexts/bling/application/mirror/FkCache'
import { ok, fail } from '@/shared/kernel/Result'
import { BLING_ENTITIES } from '@/contexts/bling/domain/mirror/BlingEntitySchema'

// Fake client: categorias 2 rows, CHILD YIELDED BEFORE PARENT -- this forces
// the orchestrator's 2-pass categoria resolution to actually do work (pass 1
// can't resolve the parent yet since it hasn't been synced; pass 2 re-syncs
// the child and picks it up). tipos flat. One contato with a tiposContato
// entry pointing at an id (999) that never appears in the tipos payload, to
// exercise the required-relation skip rule on the join entity
// (bling_contato_tipos_assigned) -- an "orphan tipo in a junction", per the
// old importer's behavior this ports. Everything else (depositos, formas,
// produtos, pedidos) empty.
function fakeClient() {
  return {
    async *paginate(path: string) {
      if (path === '/categorias/produtos') {
        yield { id: 2, descricao: 'Sub', categoriaPai: { id: 1 } }
        yield { id: 1, descricao: 'Root' }
      }
      if (path === '/contatos') yield { id: 10 }
    },
    async get(path: string) {
      if (path === '/contatos/tipos') return { data: [{ id: 3, descricao: 'Cliente' }] }
      if (path === '/contatos/10') {
        return { data: { id: 10, nome: 'Acme', tiposContato: [{ id: 999, descricao: 'Fantasma' }] } }
      }
      return { data: {} }
    },
  }
}

describe('SyncBlingMirrorService', () => {
  it('scope=all seeds, imports per tier, resolves the categoria parent via 2-pass, skips unresolved required relations, and is idempotent', async () => {
    const store = new Map<string, { recordId: string; version: number; contentHash: string }>()
    const rows: { entitySlug: string; externalId: string; recordId: string }[] = []
    let n = 0
    const syncMap = {
      listAll: async () => rows.slice(),
      get: async (s: string, e: string) => store.get(`${s}:${e}`) ?? null,
      put: async (r: { entitySlug: string; externalId: string; recordId: string; version: number; contentHash: string }) => {
        store.set(`${r.entitySlug}:${r.externalId}`, { recordId: r.recordId, version: r.version, contentHash: r.contentHash })
        if (!rows.find((x) => x.entitySlug === r.entitySlug && x.externalId === r.externalId)) {
          rows.push({ entitySlug: r.entitySlug, externalId: r.externalId, recordId: r.recordId })
        }
      },
    }
    const recordSink = {
      upsertExternal: async (i: { slug: string; externalId: string; data: Record<string, unknown> }) => {
        const key = `${i.slug}:${i.externalId}`
        const existing = store.get(key)
        const recordId = existing?.recordId ?? `rec-${n++}`
        const hash = JSON.stringify(i.data)
        const inserted = !existing
        const changed = existing?.contentHash !== hash
        await syncMap.put({ entitySlug: i.slug, externalId: i.externalId, recordId, version: (existing?.version ?? 0) + (changed ? 1 : 0), contentHash: hash })
        return ok({ recordId, changed, inserted })
      },
    }
    const ids = new Map<string, string>()
    let m = 0
    const catalog = {
      ensureEntity: async (def: { slug: string }) => { if (!ids.has(def.slug)) ids.set(def.slug, `ent-${m++}`); return ok({ entityId: ids.get(def.slug)! }) },
      ensureRelationFields: async () => ok(undefined),
    }
    const resolveOwner = { ownerId: async () => 'owner-1' }
    const svc = new SyncBlingMirrorService({
      seed: new SeedBlingEntitiesService(catalog), client: fakeClient() as never,
      recordSink, syncMap, resolveOwner, makeFk: () => new FkCache(),
    })

    const r1 = await svc.execute({ scope: 'all' })
    if (!r1.ok) throw new Error(r1.error)

    // every one of the 17 mirror entities gets a tally, even untouched ones
    expect(new Set(r1.value.entities.map((e) => e.slug))).toEqual(new Set(BLING_ENTITIES.map((d) => d.slug)))

    // categoria child resolved its parent (relRef -> parent recordId, not
    // null), even though the parent was yielded AFTER the child in the list
    const parent = store.get('bling_categorias_produtos:1')
    const child = store.get('bling_categorias_produtos:2')
    expect(parent).toBeDefined()
    expect(child).toBeDefined()
    expect(JSON.parse(child!.contentHash).categoria_pai).toBe(parent!.recordId)
    const catTally = r1.value.entities.find((e) => e.slug === 'bling_categorias_produtos')!
    expect(catTally.inserted).toBe(2) // pass 1: root + child (child's parent still unresolved)
    expect(catTally.updated).toBe(1) // pass 2: child re-synced once the parent resolves

    // the contato itself lands...
    expect(store.get('bling_contatos:10')).toBeDefined()
    // ...but the join row pointing at an unresolvable (never-imported) tipo
    // is SKIPPED outright, not written with a null required relation
    expect(store.has('bling_contato_tipos_assigned:10:999')).toBe(false)
    const joinTally = r1.value.entities.find((e) => e.slug === 'bling_contato_tipos_assigned')!
    expect(joinTally.skipped).toBeGreaterThanOrEqual(1)
    expect(joinTally.inserted).toBe(0)

    const before = store.size
    const r2 = await svc.execute({ scope: 'all' })
    if (!r2.ok) throw new Error(r2.error)
    expect(store.size).toBe(before) // idempotent: no new rows
  })

  it('fails fast when no owner can be resolved', async () => {
    const svc = new SyncBlingMirrorService({
      seed: new SeedBlingEntitiesService({ ensureEntity: async () => ok({ entityId: 'x' }), ensureRelationFields: async () => ok(undefined) }),
      client: fakeClient() as never,
      recordSink: { upsertExternal: async () => ok({ recordId: 'r', changed: true, inserted: true }) },
      syncMap: { listAll: async () => [], get: async () => null, put: async () => {} },
      resolveOwner: { ownerId: async () => null },
      makeFk: () => new FkCache(),
    })
    const r = await svc.execute({ scope: 'all' })
    expect(r.ok).toBe(false)
  })

  it('fails when entity seeding fails', async () => {
    const svc = new SyncBlingMirrorService({
      seed: new SeedBlingEntitiesService({ ensureEntity: async () => fail('boom'), ensureRelationFields: async () => ok(undefined) }),
      client: fakeClient() as never,
      recordSink: { upsertExternal: async () => ok({ recordId: 'r', changed: true, inserted: true }) },
      syncMap: { listAll: async () => [], get: async () => null, put: async () => {} },
      resolveOwner: { ownerId: async () => 'owner-1' },
      makeFk: () => new FkCache(),
    })
    const r = await svc.execute({ scope: 'all' })
    expect(r.ok).toBe(false)
  })
})
