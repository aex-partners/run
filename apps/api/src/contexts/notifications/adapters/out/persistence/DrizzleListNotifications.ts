import { desc, eq } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { notifications } from '@/platform/db/schema'
import {
  ListNotifications,
  ListNotificationsQuery,
  NotificationView,
} from '@/contexts/notifications/application/queries/ListNotifications'

// Read-side adapter (CQRS). Reads straight from the table and shapes a view — no
// domain objects. Default limit (30) mirrors the AEX `list` procedure.
export class DrizzleListNotifications implements ListNotifications {
  constructor(private readonly db: Database) {}

  async execute(q: ListNotificationsQuery): Promise<NotificationView[]> {
    const limit = q.limit ?? 30
    const rows = await this.db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, q.userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
    return rows.map(
      (r): NotificationView => ({
        id: r.id,
        userId: r.userId,
        kind: r.kind,
        taskId: r.taskId,
        title: r.title,
        body: r.body,
        readAt: r.readAt,
        createdAt: r.createdAt,
      }),
    )
  }
}
