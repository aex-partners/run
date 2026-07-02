import { JsonObject } from '@/shared/domain/Json'

// The credential store key under which the user connects Bling (via OAuth2) in
// Settings. The ResolveCredential ACL resolves the active credential for this
// plugin name; the credentials context auto-refreshes the token before returning
// the decrypted bag, so this context never runs its own OAuth flow.
export const BLING_PLUGIN = 'bling'

// Pull the OAuth2 bearer token out of the decrypted credential bag. An oauth2
// credential stores it under `access_token` (the AppConnectionValue shape); we
// also accept the camelCase / bare-token variants defensively. Pure: no I/O,
// returns null when absent.
const TOKEN_KEYS = ['access_token', 'accessToken', 'token']

export const extractAccessToken = (bag: JsonObject | null): string | null => {
  if (!bag) return null
  for (const key of TOKEN_KEYS) {
    const v = bag[key]
    if (typeof v === 'string' && v.trim().length > 0) return v
  }
  return null
}
