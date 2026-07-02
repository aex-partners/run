import { Result } from '@/shared/kernel/Result'
import { FieldTypeConfig } from '@/contexts/data/domain/FieldType'

// Ports entities.updateField: a partial patch of a single field by its stable id.
// A name change re-derives the slug; a slug or type change triggers a stored
// record-key migration / revalidation in the persistence adapter.
export interface UpdateFieldCommand {
  entityId: string
  fieldId: string
  updates: {
    name?: string
    type?: FieldTypeConfig
    required?: boolean
    unique?: boolean
    description?: string
    defaultValue?: string
  }
}

export interface UpdateField {
  execute(cmd: UpdateFieldCommand): Promise<Result<{ ok: true }>>
}
