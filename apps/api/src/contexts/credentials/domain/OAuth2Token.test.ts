import { describe, it, expect } from 'vitest'
import { OAuth2Token, REFRESH_SKEW_SECONDS } from '@/contexts/credentials/domain/OAuth2Token'
import { JsonObject } from '@/shared/domain/Json'

// Token minted at unix second 1_000_000 with a one-hour lifetime.
const CLAIMED_AT = 1_000_000
const EXPIRES_IN = 3_600
const EXPIRES_AT = CLAIMED_AT + EXPIRES_IN // 1_003_600

const bag = (overrides: JsonObject = {}): JsonObject => ({
  access_token: 'at',
  refresh_token: 'rt',
  expires_in: EXPIRES_IN,
  claimed_at: CLAIMED_AT,
  token_type: 'Bearer',
  client_id: 'cid',
  client_secret: 'secret',
  token_url: 'https://idp.example.com/token',
  token_auth_method: 'body',
  ...overrides,
})

// Unix-seconds -> Date helper.
const atSecond = (s: number) => new Date(s * 1000)

describe('OAuth2Token.parse', () => {
  it('reads the typed token out of the value bag', () => {
    const t = OAuth2Token.parse(bag())
    expect(t.accessToken).toBe('at')
    expect(t.refreshToken).toBe('rt')
    expect(t.expiresIn).toBe(EXPIRES_IN)
    expect(t.claimedAt).toBe(CLAIMED_AT)
    expect(t.tokenType).toBe('Bearer')
    expect(t.tokenAuthMethod).toBe('body')
  })

  it('is lenient: absent fields become empty string / null and Bearer/body defaults', () => {
    const t = OAuth2Token.parse({})
    expect(t.accessToken).toBe('')
    expect(t.refreshToken).toBe('')
    expect(t.expiresIn).toBeNull()
    expect(t.claimedAt).toBeNull()
    expect(t.tokenType).toBe('Bearer')
    expect(t.tokenAuthMethod).toBe('body')
  })

  it('reads basic auth method when set', () => {
    expect(OAuth2Token.parse(bag({ token_auth_method: 'basic' })).tokenAuthMethod).toBe('basic')
  })
})

describe('OAuth2Token.expiresAt', () => {
  it('is claimedAt + expiresIn', () => {
    expect(OAuth2Token.expiresAt(OAuth2Token.parse(bag()))).toBe(EXPIRES_AT)
  })

  it('is null when claimed_at or expires_in is missing', () => {
    expect(OAuth2Token.expiresAt(OAuth2Token.parse(bag({ claimed_at: null })))).toBeNull()
    expect(OAuth2Token.expiresAt(OAuth2Token.parse(bag({ expires_in: null })))).toBeNull()
  })
})

describe('OAuth2Token.isExpired', () => {
  const t = OAuth2Token.parse(bag())

  it('is false before expiry', () => {
    expect(OAuth2Token.isExpired(t, atSecond(EXPIRES_AT - 1))).toBe(false)
  })

  it('is true at/after the expiry second (>= boundary)', () => {
    expect(OAuth2Token.isExpired(t, atSecond(EXPIRES_AT))).toBe(true)
    expect(OAuth2Token.isExpired(t, atSecond(EXPIRES_AT + 1))).toBe(true)
  })

  it('is false for an unknown-expiry token', () => {
    const unknown = OAuth2Token.parse(bag({ expires_in: null }))
    expect(OAuth2Token.isExpired(unknown, atSecond(EXPIRES_AT + 10_000))).toBe(false)
  })
})

describe('OAuth2Token.needsRefresh (60s skew)', () => {
  const t = OAuth2Token.parse(bag())
  const skewStart = EXPIRES_AT - REFRESH_SKEW_SECONDS // 1_003_540

  it('uses a 60-second default skew', () => {
    expect(REFRESH_SKEW_SECONDS).toBe(60)
  })

  it('is false just before the skew window opens', () => {
    expect(OAuth2Token.needsRefresh(t, atSecond(skewStart - 1))).toBe(false)
  })

  it('is true once inside the skew window, while still not strictly expired', () => {
    expect(OAuth2Token.needsRefresh(t, atSecond(skewStart))).toBe(true)
    // Inside the skew window the token is flagged for refresh but not yet expired.
    expect(OAuth2Token.isExpired(t, atSecond(skewStart))).toBe(false)
    expect(OAuth2Token.needsRefresh(t, atSecond(EXPIRES_AT - 1))).toBe(true)
  })

  it('is true once expired', () => {
    expect(OAuth2Token.needsRefresh(t, atSecond(EXPIRES_AT + 5))).toBe(true)
  })

  it('honors a custom skew', () => {
    expect(OAuth2Token.needsRefresh(t, atSecond(EXPIRES_AT - 120), 100)).toBe(false)
    expect(OAuth2Token.needsRefresh(t, atSecond(EXPIRES_AT - 100), 100)).toBe(true)
  })

  it('never needs refresh for an unknown-expiry token', () => {
    const unknown = OAuth2Token.parse(bag({ claimed_at: null }))
    expect(OAuth2Token.needsRefresh(unknown, atSecond(EXPIRES_AT + 10_000))).toBe(false)
  })
})

describe('OAuth2Token.canRefresh', () => {
  it('is true only with both a refresh token and a token url', () => {
    expect(OAuth2Token.canRefresh(OAuth2Token.parse(bag()))).toBe(true)
    expect(OAuth2Token.canRefresh(OAuth2Token.parse(bag({ refresh_token: '' })))).toBe(false)
    expect(OAuth2Token.canRefresh(OAuth2Token.parse(bag({ token_url: '' })))).toBe(false)
  })
})

describe('OAuth2Token.applyRefresh', () => {
  it('folds new tokens back in and restamps claimed_at', () => {
    const next = OAuth2Token.applyRefresh(
      bag(),
      { accessToken: 'new-at', refreshToken: 'new-rt', expiresIn: 7_200 },
      2_000_000,
    )
    expect(next.access_token).toBe('new-at')
    expect(next.refresh_token).toBe('new-rt')
    expect(next.expires_in).toBe(7_200)
    expect(next.claimed_at).toBe(2_000_000)
    // Untouched fields are preserved.
    expect(next.client_id).toBe('cid')
    expect(next.token_url).toBe('https://idp.example.com/token')
  })

  it('keeps the old refresh_token / expires_in when the provider omits them', () => {
    const next = OAuth2Token.applyRefresh(bag(), { accessToken: 'new-at' }, 2_000_000)
    expect(next.access_token).toBe('new-at')
    expect(next.refresh_token).toBe('rt') // kept
    expect(next.expires_in).toBe(EXPIRES_IN) // kept
    expect(next.claimed_at).toBe(2_000_000)
  })

  it('does not mutate the source value bag', () => {
    const src = bag()
    OAuth2Token.applyRefresh(src, { accessToken: 'new-at' }, 2_000_000)
    expect(src.access_token).toBe('at')
  })
})

describe('OAuth2Token.buildValue', () => {
  it('builds an initial OAUTH2 value bag from a fresh exchange', () => {
    const v = OAuth2Token.buildValue({
      tokens: { accessToken: 'a', refreshToken: 'r', expiresIn: 3_600, tokenType: 'Bearer' },
      clientId: 'cid',
      clientSecret: 'sec',
      tokenUrl: 'https://idp/token',
      scope: ['read', 'write'],
      redirectUri: 'https://app/cb',
      tokenAuthMethod: 'basic',
      claimedAtSeconds: 1_234,
    })
    expect(v.type).toBe('OAUTH2')
    expect(v.access_token).toBe('a')
    expect(v.refresh_token).toBe('r')
    expect(v.expires_in).toBe(3_600)
    expect(v.claimed_at).toBe(1_234)
    expect(v.token_type).toBe('Bearer')
    expect(v.scope).toBe('read write')
    expect(v.token_auth_method).toBe('basic')
    expect(v.redirect_url).toBe('https://app/cb')
    expect(v.data).toEqual({})
  })

  it('applies defaults for missing optional fields', () => {
    const v = OAuth2Token.buildValue({
      tokens: { accessToken: 'a' },
      clientId: 'cid',
      clientSecret: 'sec',
      tokenUrl: 'https://idp/token',
      redirectUri: 'https://app/cb',
      tokenAuthMethod: 'body',
      claimedAtSeconds: 1_234,
    })
    expect(v.refresh_token).toBe('')
    expect(v.expires_in).toBeNull()
    expect(v.token_type).toBe('Bearer')
    expect(v.scope).toBe('')
  })
})
