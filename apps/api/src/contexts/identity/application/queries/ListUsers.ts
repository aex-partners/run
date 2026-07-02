// Read side (CQRS). Admin user list with derived active/inactive status. Bypasses
// the aggregate: an adapter answers with a direct query. Mirrors users.list.
export interface UserListItem {
  id: string
  name: string
  email: string
  role: string
  banned: boolean
  createdAt: Date
  status: 'active' | 'inactive'
  /** Distinguishes AI agent backing accounts from real people in the admin list. */
  kind: 'human' | 'bot'
}

export interface ListUsers {
  execute(): Promise<UserListItem[]>
}
