import { Result } from '@/shared/kernel/Result'

// Driving ports behind emails.labels.create / delete, both scoped to the
// caller's accounts.

export interface CreateLabelCommand {
  actorId: string
  accountId: string
  name: string
  color: string
}

export interface CreatedLabel {
  id: string
  accountId: string
  name: string
  color: string
}

export interface CreateLabel {
  execute(cmd: CreateLabelCommand): Promise<Result<CreatedLabel>>
}

export interface DeleteLabelCommand {
  actorId: string
  id: string
}

export interface DeleteLabel {
  execute(cmd: DeleteLabelCommand): Promise<Result<{ success: true }>>
}
