// Read side (CQRS). Like the data context's ListRecords, this bypasses the
// domain entirely: an adapter answers it with a direct query and shapes a view.
export interface NotificationView {
  id: string
  userId: string
  kind: string
  taskId: string | null
  title: string
  body: string | null
  readAt: Date | null
  createdAt: Date
}

export interface ListNotificationsQuery {
  userId: string
  limit?: number
}

export interface ListNotifications {
  execute(q: ListNotificationsQuery): Promise<NotificationView[]>
}
