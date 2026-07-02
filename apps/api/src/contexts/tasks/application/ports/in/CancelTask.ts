import { Result } from '@/shared/kernel/Result'

// Driving port (AEX `tasks.cancel`). `userId` scopes the access check.
export interface CancelTaskCommand {
  userId: string
  id: string
}

export interface CancelTask {
  execute(cmd: CancelTaskCommand): Promise<Result<{ success: true }>>
}
