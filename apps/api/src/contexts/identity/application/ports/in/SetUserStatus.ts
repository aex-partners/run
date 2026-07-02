import { Result } from '@/shared/kernel/Result'

// Toggle a user's active/inactive (ban) state. Mirrors users.updateStatus.
export interface SetUserStatusCommand {
  actorId: string
  userId: string
  status: 'active' | 'inactive'
}

export interface SetUserStatus {
  execute(cmd: SetUserStatusCommand): Promise<Result<{ success: true }>>
}
