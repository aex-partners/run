import { ReminderStatus } from '@/contexts/reminders/domain/ReminderStatus'

// Read side (CQRS). Bypasses the aggregate: an adapter answers it with a direct
// query. Mirrors the source router's list shape.
export interface ReminderView {
  id: string
  message: string
  scheduledFor: Date
  status: ReminderStatus
  conversationId: string | null
  firedAt: Date | null
}

export interface ListRemindersQuery {
  userId: string
  status?: ReminderStatus
  limit: number
}

export interface ListReminders {
  execute(query: ListRemindersQuery): Promise<ReminderView[]>
}
