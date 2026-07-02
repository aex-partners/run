import { Json, JsonObject } from '@/shared/domain/Json'

// PURE OAuth2 token lifecycle rules over a credential's stored value bag.
//
// The value of an `oauth2` credential is a JSON object in "AppConnectionValue"
// shape: access_token, refresh_token, expires_in (seconds), claimed_at (unix
// seconds the token was minted), token_url, client_id, client_secret,
// token_auth_method. These functions read that bag and decide expiry / refresh
// need WITHOUT performing any IO. The imperative shell (use cases) calls the
// OAuthClient out-port when `needsRefresh` says so.

// Seconds of slack before true expiry at which we proactively refresh — mirrors
// the source's `expiresAt - 60` buffer.
export const REFRESH_SKEW_SECONDS = 60

export interface OAuth2Token {
  accessToken: string
  refreshToken: string
  expiresIn: number | null
  claimedAt: number | null
  tokenType: string
  clientId: string
  clientSecret: string
  tokenUrl: string
  tokenAuthMethod: 'body' | 'basic'
}

const asString = (v: Json | undefined): string => (typeof v === 'string' ? v : '')
const asNumber = (v: Json | undefined): number | null => (typeof v === 'number' ? v : null)

export const OAuth2Token = {
  // Read the typed token out of the raw value bag. Lenient: absent fields become
  // '' / null so callers can guard with `canRefresh` / `needsRefresh`.
  parse(value: JsonObject): OAuth2Token {
    return {
      accessToken: asString(value['access_token']),
      refreshToken: asString(value['refresh_token']),
      expiresIn: asNumber(value['expires_in']),
      claimedAt: asNumber(value['claimed_at']),
      tokenType: asString(value['token_type']) || 'Bearer',
      clientId: asString(value['client_id']),
      clientSecret: asString(value['client_secret']),
      tokenUrl: asString(value['token_url']),
      tokenAuthMethod: value['token_auth_method'] === 'basic' ? 'basic' : 'body',
    }
  },

  // Unix-seconds at which the token expires, or null when expiry is unknown
  // (no claimed_at/expires_in recorded — treat as non-expiring).
  expiresAt(token: OAuth2Token): number | null {
    if (token.claimedAt === null || token.expiresIn === null) return null
    return token.claimedAt + token.expiresIn
  },

  // PURE. True once the token is strictly past its lifetime.
  isExpired(token: OAuth2Token, now: Date): boolean {
    const at = OAuth2Token.expiresAt(token)
    if (at === null) return false
    return Math.floor(now.getTime() / 1000) >= at
  },

  // PURE. True when the token is within REFRESH_SKEW_SECONDS of expiry (or past
  // it). Unknown-expiry tokens never need refresh.
  needsRefresh(token: OAuth2Token, now: Date, skewSeconds = REFRESH_SKEW_SECONDS): boolean {
    const at = OAuth2Token.expiresAt(token)
    if (at === null) return false
    return Math.floor(now.getTime() / 1000) >= at - skewSeconds
  },

  // A token can be refreshed only if we hold both a refresh_token and the
  // token endpoint to send it to.
  canRefresh(token: OAuth2Token): boolean {
    return token.refreshToken.length > 0 && token.tokenUrl.length > 0
  },

  // PURE. Fold freshly-exchanged tokens back into the value bag, re-stamping
  // claimed_at. Keeps the old refresh_token / expires_in when the provider omits
  // them on refresh (matches the source merge).
  applyRefresh(
    value: JsonObject,
    tokens: { accessToken: string; refreshToken?: string; expiresIn?: number },
    claimedAtSeconds: number,
  ): JsonObject {
    return {
      ...value,
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken ?? value['refresh_token'] ?? '',
      expires_in: tokens.expiresIn ?? value['expires_in'] ?? null,
      claimed_at: claimedAtSeconds,
    }
  },

  // PURE. Build the initial OAuth2 value bag from a fresh code exchange.
  buildValue(params: {
    tokens: { accessToken: string; refreshToken?: string; expiresIn?: number; tokenType?: string }
    clientId: string
    clientSecret: string
    tokenUrl: string
    scope?: string[]
    redirectUri: string
    tokenAuthMethod: 'body' | 'basic'
    claimedAtSeconds: number
  }): JsonObject {
    return {
      type: 'OAUTH2',
      access_token: params.tokens.accessToken,
      refresh_token: params.tokens.refreshToken ?? '',
      expires_in: params.tokens.expiresIn ?? null,
      claimed_at: params.claimedAtSeconds,
      token_type: params.tokens.tokenType ?? 'Bearer',
      client_id: params.clientId,
      client_secret: params.clientSecret,
      token_url: params.tokenUrl,
      scope: params.scope?.join(' ') ?? '',
      redirect_url: params.redirectUri,
      token_auth_method: params.tokenAuthMethod,
      data: {},
    }
  },
}
