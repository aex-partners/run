// ACL / driven port. Resolving a user by email belongs to the identity/users
// context, not files. ShareFile depends on this thin lookup; main bridges it to
// that context (today an adapter reads the platform `users` table directly).
export interface UserDirectory {
  findUserIdByEmail(email: string): Promise<string | null>
}
