import { Result } from '@/shared/kernel/Result'
import { JsonObject } from '@/shared/domain/Json'

// Driving port consumed by OTHER contexts (pieces/integrations) via an ACL in
// main. Given a plugin and an optional explicit credential id, returns the
// DECRYPTED value to run an action with, applying the resolution precedence
// (explicit > primary > oldest) and auto-refreshing a near-expiry OAuth token.
// Returns null when no matching credential exists.
export interface ResolveCredentialQuery {
  pluginName: string
  credentialId?: string
}

export interface ResolveCredential {
  execute(query: ResolveCredentialQuery): Promise<Result<JsonObject | null>>
}
