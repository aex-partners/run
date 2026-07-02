import { Result } from '@/shared/kernel/Result'

// Driving port (AEX `tasks.acknowledge`). The acting user must be an assignee.
// `allAcked` reports whether this ack was the last one (task -> acknowledged).
export interface AcknowledgeTaskCommand {
  userId: string
  id: string
}

export interface AcknowledgeTask {
  execute(cmd: AcknowledgeTaskCommand): Promise<Result<{ success: true; allAcked: boolean }>>
}
