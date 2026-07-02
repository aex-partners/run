import { Notification } from '@/contexts/notifications/domain/Notification'
import { NotificationKind } from '@/contexts/notifications/domain/NotificationKind'
import { NotificationId, UserId, TaskId } from '@/contexts/notifications/domain/ids'

// Persistence row for the `notifications` table. The mapper is the only place
// that knows the on-disk shape.
export interface NotificationRow {
  id: string
  userId: string
  kind: string
  taskId: string | null
  title: string
  body: string | null
  readAt: Date | null
  createdAt: Date
}

export const NotificationMapper = {
  toPersistence(notification: Notification): NotificationRow {
    return {
      id: notification.id.value,
      userId: notification.userId.value,
      kind: notification.kind.value,
      taskId: notification.taskId?.value ?? null,
      title: notification.title,
      body: notification.body,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
    }
  },

  toDomain(row: NotificationRow): Notification {
    const kind = NotificationKind.of(row.kind)
    if (!kind.ok) throw new Error(`NotificationMapper.toDomain: ${kind.error}`)
    return Notification.rehydrate({
      id: NotificationId.of(row.id),
      userId: UserId.of(row.userId),
      kind: kind.value,
      title: row.title,
      body: row.body,
      taskId: row.taskId === null ? null : TaskId.of(row.taskId),
      readAt: row.readAt,
      createdAt: row.createdAt,
    })
  },
}
