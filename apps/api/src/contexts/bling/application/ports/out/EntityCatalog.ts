import { Result } from '@/shared/kernel/Result'
import { BlingEntityDef } from '@/contexts/bling/domain/mirror/BlingEntitySchema'

// ACL out-port -> the data/catalog context. The mirror sync declares an entity
// definition (slug, fields, relation targets) and this port ensures the
// matching entity and its fields exist, creating or reconciling as needed.
// `slugToId` lets the adapter resolve relation targets that were created
// earlier in the same sync run without re-querying the catalog.
export interface EntityCatalog {
  // Ensure the entity and its non-relation fields exist. Returns the entity id.
  // `createdBy` is the resolved sync owner id, threaded through to
  // entities.created_by on creation.
  ensureEntity(
    def: BlingEntityDef,
    slugToId: Map<string, string>,
    createdBy: string,
  ): Promise<Result<{ entityId: string }>>

  // Ensure relation fields exist, wiring each to its target entity id via slugToId.
  ensureRelationFields(def: BlingEntityDef, slugToId: Map<string, string>): Promise<Result<void>>
}
