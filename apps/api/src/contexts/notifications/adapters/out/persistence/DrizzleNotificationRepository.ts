import { randomUUID } from 'node:crypto'
import { and, eq, gt, isNull } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { notifications } from '@/platform/db/schema'
import {
  NotificationRepository,
  UnreadNotificationItem,
} from '@/contexts/notifications/application/ports/out/NotificationRepository'
import { Notification } from '@/contexts/notifications/domain/Notification'
import { NotificationId, UserId } from '@/contexts/notifications/domain/ids'
import { NotificationMapper } from '@/contexts/notifications/application/mappers/NotificationMapper'

// Driven adapter over Drizzle/Postgres. The port and mapper stay identical to any
// other backing store; only the SQL lives here.
export class DrizzleNotificationRepository implements NotificationRepository {
  constructor(private readonly db: Database) {}

  nextId(): NotificationId {
    return NotificationId.of(randomUUID())
  }

  async findById(id: NotificationId): Promise<Notification | null> {
    const rows = await this.db.select().from(notifications).where(eq(notifications.id, id.value)).limit(1)
    const row = rows[0]
    if (!row) return null
    return NotificationMapper.toDomain({
      id: row.id,
      userId: row.userId,
      kind: row.kind,
      taskId: row.taskId,
      title: row.title,
      body: row.body,
      readAt: row.readAt,
      createdAt: row.createdAt,
    })
  }

  // Upsert covers both create (new row) and the read-once transition (existing
  // row -> set readAt). createdAt is never overwritten on conflict.
  async save(notification: Notification): Promise<void> {
    const row = NotificationMapper.toPersistence(notification)
    await this.db
      .insert(notifications)
      .values({
        id: row.id,
        userId: row.userId,
        kind: row.kind as (typeof notifications.$inferInsert)['kind'],
        taskId: row.taskId,
        title: row.title,
        body: row.body,
        readAt: row.readAt,
        createdAt: row.createdAt,
      })
      .onConflictDoUpdate({
        target: notifications.id,
        set: { readAt: row.readAt },
      })
  }

  async markAllReadForUser(userId: UserId, now: Date): Promise<void> {
    await this.db
      .update(notifications)
      .set({ readAt: now })
      .where(and(eq(notifications.userId, userId.value), isNull(notifications.readAt)))
  }

  async findUnreadForUserSince(userId: UserId, since: Date): Promise<UnreadNotificationItem[]> {
    const rows = await this.db
      .select({ title: notifications.title, body: notifications.body })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId.value),
          isNull(notifications.readAt),
          gt(notifications.createdAt, since),
        ),
      )
      .orderBy(notifications.createdAt)
    return rows.map((r) => ({ title: r.title, body: r.body }))
  }

  async unreadRecipientIds(): Promise<UserId[]> {
    const rows = await this.db
      .selectDistinct({ userId: notifications.userId })
      .from(notifications)
      .where(isNull(notifications.readAt))
    return rows.map((r) => UserId.of(r.userId))
  }
}
