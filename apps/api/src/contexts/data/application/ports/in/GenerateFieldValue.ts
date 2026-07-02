import { Result } from '@/shared/kernel/Result'

// Ports entities.generateFieldValue: ask the model to fill one field of one
// record from a prompt (with {field_slug} placeholders resolved from the record),
// then persist the generated value via compare-and-set.
export interface GenerateFieldValueCommand {
  entityId: string
  recordId: string
  fieldId: string
  prompt: string
}

export interface GenerateFieldValue {
  execute(cmd: GenerateFieldValueCommand): Promise<Result<{ value: string }>>
}
