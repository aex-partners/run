import { FieldName } from '@/contexts/data/domain/FieldName'
import { FieldType } from '@/contexts/data/domain/FieldType'

// AEX-shape metadata the domain carries through but does not enforce: the field's
// stable id, its human display name (distinct from the snake_case slug/key), an
// optional description, a uniqueness hint, and a default value. Kept optional so
// the existing callers (which pass only name/type/required) stay valid.
export interface FieldMeta {
  id?: string
  displayName?: string
  description?: string
  unique?: boolean
  defaultValue?: string
}

// VO pairing a name (the JSON key / slug) with its type strategy, a required
// flag, and the AEX presentation metadata.
export class Field {
  constructor(
    public readonly name: FieldName,
    public readonly type: FieldType,
    public readonly required: boolean,
    public readonly meta: FieldMeta = {},
  ) {}
}
