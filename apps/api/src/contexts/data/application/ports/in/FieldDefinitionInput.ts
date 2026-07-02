import { FieldTypeConfig } from '@/contexts/data/domain/FieldType'

// Plain-data field definition crossing the driving boundary. `name` is the field
// key/slug (must match FieldName's /^[a-z][a-z0-9_]*$/); the driving adapter
// derives it from the AEX display name via Slug and passes the original as
// `displayName`. `id` is assigned by the adapter (it owns id generation).
export interface FieldDefinitionInput {
  id?: string
  name: string
  displayName?: string
  required: boolean
  unique?: boolean
  description?: string
  defaultValue?: string
  type: FieldTypeConfig
}
