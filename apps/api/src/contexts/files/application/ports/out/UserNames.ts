// ACL (anti-corruption) out-port -> identity/users. The share read adapter stores
// only the grantee userIds (files owns `fileShares`, not `users`); it MUST NOT
// read the `users` table. It batch-collects the distinct userIds and asks this
// directory for their display info (name + email, which the share view exposes
// and also uses as the name fallback). main bridges this to identity.GetUsers.
// A userId that resolves to nothing is absent from the map (the adapter omits
// that share row, mirroring the previous inner join).
export interface UserInfo {
  name: string
  email: string
}

export interface UserNames {
  names(ids: string[]): Promise<Map<string, UserInfo>>
}
