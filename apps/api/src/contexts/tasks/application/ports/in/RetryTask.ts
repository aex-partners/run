import { Result } from '@/shared/kernel/Result'

// Driving port (AEX `tasks.retry`). Clones a finished/failed task into a new
// pending one and enqueues it. Returns the new task id.
export interface RetryTaskCommand {
  userId: string
  id: string
}

export interface RetryTask {
  execute(cmd: RetryTaskCommand): Promise<Result<{ id: string }>>
}
