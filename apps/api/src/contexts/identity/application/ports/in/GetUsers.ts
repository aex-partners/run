// Driving port (read) serving other contexts' ACL. Identity owns the `users`
// table; files/conversations/notifications resolve author/actor identities
// through this port instead of reading `users` directly. Empty ids -> [].
export interface UserRef {
  id: string
  name: string
  email: string
  image: string | null
  role: string
}

export interface GetUsers {
  execute(ids: string[]): Promise<UserRef[]>
}
