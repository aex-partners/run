import { Result } from '@/shared/kernel/Result'

// Driving port (AEX `tasks.snooze`). The acting user must be an assignee.
// `until` is an ISO-8601 datetime string.
export interface SnoozeTaskCommand {
  userId: string
  id: string
  until: string
}

export interface SnoozeTask {
  execute(cmd: SnoozeTaskCommand): Promise<Result<{ success: true; until: string }>>
}
