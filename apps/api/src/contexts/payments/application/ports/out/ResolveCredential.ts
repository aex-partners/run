import { Result } from '@/shared/kernel/Result'
import { JsonObject } from '@/shared/domain/Json'

// ACL out-port -> the credentials context. The payments context must NOT import
// credentials, so it declares WHAT it needs (the decrypted credential value for a
// plugin) and main fulfills HOW by bridging to the credentials ResolveCredential
// in-port. Returns null when PagSeguro has not been connected. Shape mirrors the
// plugins ResolveCredential ACL and the credentials in-port query.
export interface ResolveCredentialRequest {
  pluginName: string
  credentialId?: string
}

export interface ResolveCredential {
  resolve(req: ResolveCredentialRequest): Promise<Result<JsonObject | null>>
}
