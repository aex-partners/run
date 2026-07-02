import { and, asc, desc, eq } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { reminders } from '@/platform/db/schema'
import {
  ListReminders,
  ListRemindersQuery,
  ReminderView,
} from '@/contexts/reminders/application/ports/in/ListReminders'

// Driven read-side adapter (CQRS). Answers the ListReminders query with a direct
// SQL query — no aggregate, no mapper round-trip. Scheduled reminders sort by
// soonest-first; history sorts newest-first (matches the source router).
export class DrizzleListReminders implements ListReminders {
  constructor(private readonly db: Database) {}

  async execute(query: ListRemindersQuery): Promise<ReminderView[]> {
    const conditions = [eq(reminders.userId, query.userId)]
    if (query.status) conditions.push(eq(reminders.status, query.status))

    const order = query.status === 'scheduled' ? asc(reminders.scheduledFor) : desc(reminders.createdAt)

    const rows = await this.db
      .select()
      .from(reminders)
      .where(and(...conditions))
      .orderBy(order)
      .limit(query.limit)

    return rows.map((r) => ({
      id: r.id,
      message: r.message,
      scheduledFor: r.scheduledFor,
      status: r.status,
      conversationId: r.conversationId,
      firedAt: r.firedAt,
    }))
  }
}
