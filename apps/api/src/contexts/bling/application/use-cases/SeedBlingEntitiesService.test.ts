import { describe, it, expect } from 'vitest'
import { SeedBlingEntitiesService } from '@/contexts/bling/application/use-cases/SeedBlingEntitiesService'
import { EntityCatalog } from '@/contexts/bling/application/ports/out/EntityCatalog'
import { ok } from '@/shared/kernel/Result'
import { BLING_ENTITIES } from '@/contexts/bling/domain/mirror/BlingEntitySchema'

function fakeCatalog() {
  const ids = new Map<string, string>()
  let n = 0
  const relCalls: string[] = []
  const catalog: EntityCatalog = {
    ensureEntity: async (def, slugToId) => {
      if (!ids.has(def.slug)) ids.set(def.slug, `ent-${n++}`)
      return ok({ entityId: ids.get(def.slug)! })
    },
    ensureRelationFields: async (def, slugToId) => {
      relCalls.push(def.slug)
      return ok(undefined)
    },
  }
  return { catalog, ids, relCalls }
}

describe('SeedBlingEntitiesService', () => {
  it('creates all 17 entities then wires relation fields, returns slug→id', async () => {
    const { catalog, relCalls } = fakeCatalog()
    const res = await new SeedBlingEntitiesService(catalog).execute()
    if (!res.ok) throw new Error(res.error)
    expect(res.value.size).toBe(17)
    // relation-field pass runs for every entity that declares a relation
    const withRel = BLING_ENTITIES.filter((e) => e.fields.some((f) => f.type.kind === 'relation')).map(
      (e) => e.slug,
    )
    expect(new Set(relCalls)).toEqual(new Set(withRel))
  })
})
