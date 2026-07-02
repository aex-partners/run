import { NotificationPreferences } from '@/contexts/notifications/domain/NotificationPreferences'
import { UserId } from '@/contexts/notifications/domain/ids'

// Persistence row for the `notification_preferences` table (userId is the PK).
export interface NotificationPreferencesRow {
  userId: string
  emailDigest: boolean
  lastDigestSentAt: Date | null
  updatedAt: Date
}

export const NotificationPreferencesMapper = {
  toPersistence(prefs: NotificationPreferences): NotificationPreferencesRow {
    return {
      userId: prefs.id.value,
      emailDigest: prefs.emailDigest,
      lastDigestSentAt: prefs.lastDigestSentAt,
      updatedAt: prefs.updatedAt,
    }
  },

  toDomain(row: NotificationPreferencesRow): NotificationPreferences {
    return NotificationPreferences.rehydrate(
      UserId.of(row.userId),
      row.emailDigest,
      row.lastDigestSentAt,
      row.updatedAt,
    )
  },
}
