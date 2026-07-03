import { describe, it, expect } from 'vitest'
import { SeedBlingEntitiesService } from '@/contexts/bling/application/use-cases/SeedBlingEntitiesService'
import { EntityCatalog } from '@/contexts/bling/application/ports/out/EntityCatalog'
import { ok } from '@/shared/kernel/Result'
import { BLING_ENTITIES } from '@/contexts/bling/domain/mirror/BlingEntitySchema'

function fakeCatalog() {
  const ids = new Map<string, string>()
  let n = 0
  const relCalls: string[] = []
  const createdByCalls: (string | undefined)[] = []
  const catalog: EntityCatalog = {
    ensureEntity: async (def, slugToId, createdBy) => {
      if (!ids.has(def.slug)) ids.set(def.slug, `ent-${n++}`)
      createdByCalls.push(createdBy)
      return ok({ entityId: ids.get(def.slug)! })
    },
    ensureRelationFields: async (def, slugToId) => {
      if (slugToId.size !== 17) {
        throw new Error(`ensureRelationFields called before phase A finished: slugToId.size=${slugToId.size}`)
      }
      relCalls.push(def.slug)
      return ok(undefined)
    },
  }
  return { catalog, ids, relCalls, createdByCalls }
}

describe('SeedBlingEntitiesService', () => {
  it('creates all 17 entities then wires relation fields, returns slug→id', async () => {
    const { catalog, relCalls } = fakeCatalog()
    const res = await new SeedBlingEntitiesService(catalog).execute('owner-1')
    if (!res.ok) throw new Error(res.error)
    expect(res.value.size).toBe(17)
    // relation-field pass runs for every entity that declares a relation
    const withRel = BLING_ENTITIES.filter((e) => e.fields.some((f) => f.type.kind === 'relation')).map(
      (e) => e.slug,
    )
    expect(new Set(relCalls)).toEqual(new Set(withRel))
  })

  // Regression: the owner id resolved by the orchestrator must be threaded
  // into every ensureEntity call as createdBy, so entities.created_by is never
  // persisted empty (NOT NULL + FK to users.id on real Postgres).
  it('passes the owner id as createdBy on every ensureEntity call', async () => {
    const { catalog, createdByCalls } = fakeCatalog()
    const res = await new SeedBlingEntitiesService(catalog).execute('owner-42')
    if (!res.ok) throw new Error(res.error)
    expect(createdByCalls.length).toBe(17)
    expect(createdByCalls.every((c) => c === 'owner-42')).toBe(true)
  })
})
