import { Notification } from '@/contexts/notifications/domain/Notification'
import { NotificationId, UserId } from '@/contexts/notifications/domain/ids'

// One unread item gathered for the digest. A read shape (title + body only), not
// a full aggregate — the digest never mutates the notifications it reports.
export interface UnreadNotificationItem {
  title: string
  body: string | null
}

// Driven port. The application states WHAT it needs from persistence; an adapter
// under adapters/out implements HOW (Drizzle, in-memory, ...).
export interface NotificationRepository {
  nextId(): NotificationId
  findById(id: NotificationId): Promise<Notification | null>
  save(notification: Notification): Promise<void>
  // Set-based transition: mark every unread notification of a user read. Bulk by
  // design — loading each aggregate would be wasteful and buys nothing here.
  markAllReadForUser(userId: UserId, now: Date): Promise<void>
  // Digest read: unread notifications for a user created strictly after `since`,
  // oldest first.
  findUnreadForUserSince(userId: UserId, since: Date): Promise<UnreadNotificationItem[]>
  // Digest sweep seed: every user that currently has at least one unread
  // notification. These are the only users a digest run can possibly notify (a
  // user with no unread is skipped regardless of preferences), so this owned-table
  // read replaces the old `users` LEFT JOIN as the candidate set. The service still
  // resolves each user's preferences and per-user unread window.
  unreadRecipientIds(): Promise<UserId[]>
}
