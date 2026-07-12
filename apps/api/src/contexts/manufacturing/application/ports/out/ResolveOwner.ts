// ACL out-port -> the identity/tenancy context. Resolves the owner id that
// manufacturing's record writes should be attributed to. Returns null when no
// owner can be resolved (e.g. no tenant configured), letting the caller decide
// how to fail.
export interface ResolveOwner {
  ownerId(): Promise<string | null>
}
