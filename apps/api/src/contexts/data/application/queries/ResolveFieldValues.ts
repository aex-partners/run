import { Json } from '@/shared/domain/Json'

// Read side. Batch-resolves a set of record ids belonging to ONE entity into the
// value of a SINGLE field (referenced by slug or field id). Generalizes
// ResolveLabels (which is fixed to the entity's title field) to an arbitrary
// field. Powers the web Table View's LOOKUP columns: a lookup field reads
// `lookupFieldId` from the record pointed to by a relation field, so the adapter
// batch-resolves that field's value for the relation's target ids.
export interface ResolveFieldValuesInput {
  entityId: string
  ids: string[]
  // The field to read from each target record — its slug (JSON key) OR its id.
  fieldSlug: string
}

export interface FieldValuePair {
  id: string
  value: Json
}

export interface ResolveFieldValuesResult {
  values: FieldValuePair[]
}

export interface ResolveFieldValues {
  execute(input: ResolveFieldValuesInput): Promise<ResolveFieldValuesResult>
}
