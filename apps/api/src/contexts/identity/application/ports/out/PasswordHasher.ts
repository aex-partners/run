// ACL out-port for credential hashing. Declared here so the domain never touches
// a crypto library; the real hashing is owned by better-auth (the `accounts`
// row). Wired in main. Interface only.
export interface PasswordHasher {
  hash(plain: string): Promise<string>
  verify(plain: string, hashed: string): Promise<boolean>
}
