// Driven port that binds the OAuth `state` parameter so the callback cannot be
// forged (confused-deputy / CSRF protection). `sign` produces an opaque,
// URL-safe token carrying the payload; `verify` returns the payload only if the
// token is intact, else null. The adapter (adapters/out/crypto) provides an
// authenticated binding — see the adapter for the integrity-vs-confidentiality
// note, since the payload carries the client secret.
export interface OAuthStatePayload {
  pluginName: string
  userId: string
  clientId: string
  clientSecret: string
}

export interface StateSigner {
  sign(payload: OAuthStatePayload): string
  verify(state: string): OAuthStatePayload | null
}
