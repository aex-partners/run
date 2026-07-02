import { Result } from '@/shared/kernel/Result'
import { FieldTypeConfig } from '@/contexts/data/domain/FieldType'

export interface AddFieldCommand {
  entityId: string
  name: string
  required: boolean
  type: FieldTypeConfig
  // AEX-shape metadata (optional; supplied by the driving adapter).
  id?: string
  displayName?: string
  unique?: boolean
  description?: string
  defaultValue?: string
}

export interface AddField {
  execute(cmd: AddFieldCommand): Promise<Result<{ id: string }>>
}
