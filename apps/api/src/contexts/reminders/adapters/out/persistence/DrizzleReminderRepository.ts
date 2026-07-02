import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { reminders } from '@/platform/db/schema'
import { ReminderRepository } from '@/contexts/reminders/application/ports/out/ReminderRepository'
import { Reminder } from '@/contexts/reminders/domain/Reminder'
import { ReminderId } from '@/contexts/reminders/domain/ids'
import { ReminderMapper } from '@/contexts/reminders/application/mappers/ReminderMapper'

// Driven adapter. Stores the aggregate in the `reminders` table. `save` upserts
// (create + every transition land here); the port and the mapper are the only
// contract the application sees.
export class DrizzleReminderRepository implements ReminderRepository {
  constructor(private readonly db: Database) {}

  nextId(): ReminderId {
    return ReminderId.of(randomUUID())
  }

  async findById(id: ReminderId): Promise<Reminder | null> {
    const [row] = await this.db.select().from(reminders).where(eq(reminders.id, id.value)).limit(1)
    return row ? ReminderMapper.toDomain(row) : null
  }

  async save(reminder: Reminder): Promise<void> {
    const row = ReminderMapper.toPersistence(reminder)
    await this.db
      .insert(reminders)
      .values(row)
      .onConflictDoUpdate({
        target: reminders.id,
        set: {
          conversationId: row.conversationId,
          message: row.message,
          scheduledFor: row.scheduledFor,
          status: row.status,
          firedAt: row.firedAt,
          jobId: row.jobId,
          deliverEmail: row.deliverEmail,
          updatedAt: row.updatedAt,
        },
      })
  }
}
