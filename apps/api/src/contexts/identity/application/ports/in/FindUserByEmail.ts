// Provider in-port (read) serving other contexts' ACL. Identity owns the `users`
// table; the files context resolves a share grantee BY EMAIL through this port
// instead of reading `users` directly. Returns the user id, or null when no user
// has that email. main bridges files.UserDirectory to this in-port.
export interface FindUserByEmail {
  execute(email: string): Promise<string | null>
}
