import { Result } from '@/shared/kernel/Result'

// Ports entities.removeField: drop a field by its stable id. The persistence
// adapter also strips the field's key from every stored record.
export interface RemoveFieldCommand {
  entityId: string
  fieldId: string
}

export interface RemoveField {
  execute(cmd: RemoveFieldCommand): Promise<Result<{ ok: true }>>
}
