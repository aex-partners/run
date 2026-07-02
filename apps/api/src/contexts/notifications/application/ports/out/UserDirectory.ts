// ACL / driven out-port toward the identity context. Notifications owns no `users`
// table: the digest needs each recipient's name and email to address the message.
// It states WHAT it needs (resolve users by id) and main bridges HOW (identity's
// GetUsers in-port). Ids with no matching user are simply absent from the result.
export interface UserRef {
  id: string
  name: string
  email: string
}

export interface UserDirectory {
  byIds(ids: string[]): Promise<UserRef[]>
}
