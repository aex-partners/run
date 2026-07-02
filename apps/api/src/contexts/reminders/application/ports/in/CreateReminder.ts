import { Result } from '@/shared/kernel/Result'

// Driving port. Plain-data command in, plain-data out. Called by the AI
// `schedule_reminder` tool (and any HTTP create), never with a domain object.
export interface CreateReminderCommand {
  userId: string
  conversationId: string | null
  message: string
  scheduledFor: Date
  deliverEmail: boolean
}

export interface CreateReminder {
  execute(cmd: CreateReminderCommand): Promise<Result<{ id: string; scheduledFor: string; status: string }>>
}
