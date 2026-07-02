import { Result } from '@/shared/kernel/Result'
import { JsonObject } from '@/shared/domain/Json'

// ACL out-port -> the credentials context. The fiscal context must NOT import
// credentials, so it declares WHAT it needs (the decrypted credential value for a
// plugin) and main fulfills HOW by bridging to the credentials ResolveCredential
// in-port (the SAME provider payments uses). Returns null when the A1 certificate
// has not been connected. Shape mirrors the payments ResolveCredential ACL.
export interface ResolveCredentialRequest {
  pluginName: string
  credentialId?: string
}

export interface ResolveCredential {
  resolve(req: ResolveCredentialRequest): Promise<Result<JsonObject | null>>
}
