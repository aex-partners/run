import { EntityFieldSpec } from '@/contexts/forms/domain/EntityFieldSpec'

// ACL out-port (read side) to the `data` context. CreateForm seeds a form with an
// entity's fields and SubmitForm validates against them — both need to know the
// entity's field definitions without importing the data context. Returns null
// when the entity does not exist. Fulfilled in main against the data context.
export interface EntityCatalog {
  fieldsOf(entityId: string): Promise<EntityFieldSpec[] | null>
}
