import { eq } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { notificationPreferences } from '@/platform/db/schema'
import { NotificationPreferencesRepository } from '@/contexts/notifications/application/ports/out/NotificationPreferencesRepository'
import { NotificationPreferences } from '@/contexts/notifications/domain/NotificationPreferences'
import { UserId } from '@/contexts/notifications/domain/ids'
import { NotificationPreferencesMapper } from '@/contexts/notifications/application/mappers/NotificationPreferencesMapper'

export class DrizzleNotificationPreferencesRepository implements NotificationPreferencesRepository {
  constructor(private readonly db: Database) {}

  async findByUserId(userId: UserId): Promise<NotificationPreferences | null> {
    const rows = await this.db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId.value))
      .limit(1)
    const row = rows[0]
    if (!row) return null
    return NotificationPreferencesMapper.toDomain({
      userId: row.userId,
      emailDigest: row.emailDigest,
      lastDigestSentAt: row.lastDigestSentAt,
      updatedAt: row.updatedAt,
    })
  }

  async save(prefs: NotificationPreferences): Promise<void> {
    const row = NotificationPreferencesMapper.toPersistence(prefs)
    await this.db
      .insert(notificationPreferences)
      .values({
        userId: row.userId,
        emailDigest: row.emailDigest,
        lastDigestSentAt: row.lastDigestSentAt,
        updatedAt: row.updatedAt,
      })
      .onConflictDoUpdate({
        target: notificationPreferences.userId,
        set: {
          emailDigest: row.emailDigest,
          lastDigestSentAt: row.lastDigestSentAt,
          updatedAt: row.updatedAt,
        },
      })
  }
}
