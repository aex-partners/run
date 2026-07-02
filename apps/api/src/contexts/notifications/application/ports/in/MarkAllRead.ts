import { Result } from '@/shared/kernel/Result'

// Driving port. Marks every unread notification of a user read in one set-based
// transition.
export interface MarkAllReadCommand {
  userId: string
}

export interface MarkAllRead {
  execute(cmd: MarkAllReadCommand): Promise<Result<{ success: true }>>
}
