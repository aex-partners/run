import { Reminder } from '@/contexts/reminders/domain/Reminder'
import { ReminderId } from '@/contexts/reminders/domain/ids'
import { ReminderStatus } from '@/contexts/reminders/domain/ReminderStatus'

// Persistence row: the on-disk shape of the `reminders` table. `deliverEmail` is
// stored as an integer flag (0/1). The mapper is the only place that knows it.
export interface ReminderRow {
  id: string
  userId: string
  conversationId: string | null
  message: string
  scheduledFor: Date
  status: ReminderStatus
  firedAt: Date | null
  jobId: string | null
  deliverEmail: number
  createdAt: Date
  updatedAt: Date
}

export const ReminderMapper = {
  toPersistence(reminder: Reminder): ReminderRow {
    return {
      id: reminder.id.value,
      userId: reminder.userId,
      conversationId: reminder.conversationId,
      message: reminder.message,
      scheduledFor: reminder.scheduledFor,
      status: reminder.status,
      firedAt: reminder.firedAt,
      jobId: reminder.jobId,
      deliverEmail: reminder.deliverEmail ? 1 : 0,
      createdAt: reminder.createdAt,
      updatedAt: reminder.updatedAt,
    }
  },

  toDomain(row: ReminderRow): Reminder {
    return Reminder.rehydrate({
      id: ReminderId.of(row.id),
      userId: row.userId,
      conversationId: row.conversationId,
      message: row.message,
      scheduledFor: row.scheduledFor,
      status: row.status,
      firedAt: row.firedAt,
      jobId: row.jobId,
      deliverEmail: row.deliverEmail === 1,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })
  },
}
