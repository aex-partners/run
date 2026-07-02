import { NotificationPreferences } from '@/contexts/notifications/domain/NotificationPreferences'
import { UserId } from '@/contexts/notifications/domain/ids'

// Driven port for digest settings. Owns only the notification_preferences table;
// the digest candidate set (users) comes from the UserDirectory ACL out-port and
// NotificationRepository.unreadRecipientIds, never from a direct `users` read.
export interface NotificationPreferencesRepository {
  findByUserId(userId: UserId): Promise<NotificationPreferences | null>
  save(prefs: NotificationPreferences): Promise<void>
}
