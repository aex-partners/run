import { EntityFieldOption } from '@/contexts/data/domain/FieldType'

// Cross-context read in-port. Returns an entity's field definitions without
// exposing the domain aggregate. Consumed by:
//  - the forms context's EntityCatalog ACL (fieldsOf), wired in main;
//  - the AI's describe_entity / list_entities tools.

export interface EntityFieldView {
  id: string
  name: string
  slug: string
  type: string
  required: boolean
  defaultValue?: string
  description?: string
  options?: EntityFieldOption[]
  maxRating?: number
  currencyCode?: string
  relationshipEntityId?: string
  relationshipEntityName?: string
  labelFieldId?: string
  multiple?: boolean
  viaFieldId?: string
  lookupFieldId?: string
  aiPrompt?: string
}

export interface EntityDescription {
  id: string
  name: string
  slug: string
  description: string | null
  createdAt: Date
  fields: EntityFieldView[]
}

export interface DescribeEntity {
  // Resolves by entity id, slug, or name. Returns null when absent.
  execute(ref: string): Promise<EntityDescription | null>
}
