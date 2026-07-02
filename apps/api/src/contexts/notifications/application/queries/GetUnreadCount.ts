// Read side (CQRS). Counts a user's unread notifications straight from the store;
// drives the unread badge. No aggregate is loaded.
export interface GetUnreadCountQuery {
  userId: string
}

export interface GetUnreadCount {
  execute(q: GetUnreadCountQuery): Promise<number>
}
