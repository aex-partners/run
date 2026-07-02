import { Result, fail, ok } from '@/shared/kernel/Result'
import { EntityCatalog } from '@/contexts/bling/application/ports/out/EntityCatalog'
import { BLING_ENTITIES } from '@/contexts/bling/domain/mirror/BlingEntitySchema'

// Idempotently ensures the 17 mirror entities exist. Phase A creates each entity
// with its non-relation fields; phase B adds relation fields once every slug's
// entityId is known (so self- and cross-references resolve). Safe every sync.
export class SeedBlingEntitiesService {
  constructor(private readonly catalog: EntityCatalog) {}

  async execute(): Promise<Result<Map<string, string>>> {
    const slugToId = new Map<string, string>()

    // Phase A: Create entities with non-relation fields
    for (const def of BLING_ENTITIES) {
      const r = await this.catalog.ensureEntity(def, slugToId)
      if (!r.ok) return fail(r.error)
      slugToId.set(def.slug, r.value.entityId)
    }

    // Phase B: Wire relation fields once all entity IDs are known
    for (const def of BLING_ENTITIES) {
      if (!def.fields.some((f) => f.type.kind === 'relation')) continue
      const r = await this.catalog.ensureRelationFields(def, slugToId)
      if (!r.ok) return fail(r.error)
    }

    return ok(slugToId)
  }
}
