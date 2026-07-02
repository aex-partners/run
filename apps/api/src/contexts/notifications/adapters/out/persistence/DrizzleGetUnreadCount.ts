import { and, eq, isNull, sql } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { notifications } from '@/platform/db/schema'
import {
  GetUnreadCount,
  GetUnreadCountQuery,
} from '@/contexts/notifications/application/queries/GetUnreadCount'

// Read-side adapter (CQRS). count(*) of a user's unread notifications.
export class DrizzleGetUnreadCount implements GetUnreadCount {
  constructor(private readonly db: Database) {}

  async execute(q: GetUnreadCountQuery): Promise<number> {
    const rows = await this.db
      .select({ c: sql<number>`count(*)` })
      .from(notifications)
      .where(and(eq(notifications.userId, q.userId), isNull(notifications.readAt)))
    return Number(rows[0]?.c ?? 0)
  }
}
