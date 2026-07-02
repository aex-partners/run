import { JsonObject } from '@/shared/domain/Json'

// The credential store key under which the user connects PagSeguro in Settings.
// The ResolveCredential ACL resolves the active credential for this plugin name.
export const PAGSEGURO_PLUGIN = 'pagseguro'

// Pull the bearer token out of the decrypted credential bag. The credential is an
// opaque secret bag interpreted by its consumer, so we accept the common key
// names a "secret_text" / "custom_auth" PagSeguro credential might use and fall
// back to the first non-empty string. Pure: no I/O, returns null when absent.
const TOKEN_KEYS = ['token', 'apiKey', 'api_key', 'accessToken', 'access_token', 'secret']

export const extractToken = (bag: JsonObject | null): string | null => {
  if (!bag) return null
  for (const key of TOKEN_KEYS) {
    const v = bag[key]
    if (typeof v === 'string' && v.trim().length > 0) return v
  }
  for (const v of Object.values(bag)) {
    if (typeof v === 'string' && v.trim().length > 0) return v
  }
  return null
}
