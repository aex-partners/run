import { Result } from '@/shared/kernel/Result'
import { JsonObject } from '@/shared/domain/Json'

// ACL out-port -> the credentials context. The plugins context must NOT import
// credentials, so it declares WHAT it needs (the decrypted credential value for a
// plugin, applying precedence + OAuth auto-refresh) and main fulfills HOW by
// bridging to the credentials ResolveCredential in-port. Returns null when no
// credential is configured. Shape mirrors the credentials in-port query.
export interface ResolveCredentialRequest {
  pluginName: string
  credentialId?: string
}

export interface ResolveCredential {
  resolve(req: ResolveCredentialRequest): Promise<Result<JsonObject | null>>
}
