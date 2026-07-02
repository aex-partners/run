import { createHmac, timingSafeEqual } from 'node:crypto'
import {
  StateSigner,
  OAuthStatePayload,
} from '@/contexts/credentials/application/ports/out/StateSigner'

// Driven adapter for the StateSigner port. Binds the OAuth `state` with an
// HMAC-SHA256 tag so the callback can detect a forged/tampered state:
//
//   state = base64url(JSON(payload)) . base64url(HMAC-SHA256(secret, payloadB64))
//
// `verify` recomputes the tag and compares in constant time before trusting the
// payload. The secret is injected (BETTER_AUTH_SECRET in main).
//
// NOTE — integrity vs confidentiality: an HMAC binding proves the payload wasn't
// tampered with but leaves it READABLE (the payload carries the OAuth client
// secret, base64-encoded in the URL). The original source instead AES-encrypted
// the state, keeping that secret confidential. If the state must carry the client
// secret in production, swap this for an authenticated-encryption signer (e.g.
// reuse AesCredentialCipher) or drop the secret from the payload.
export class HmacStateSigner implements StateSigner {
  constructor(private readonly secret: string) {}

  sign(payload: OAuthStatePayload): string {
    const body = toBase64Url(Buffer.from(JSON.stringify(payload), 'utf8'))
    return `${body}.${this.tag(body)}`
  }

  verify(state: string): OAuthStatePayload | null {
    try {
      const dot = state.lastIndexOf('.')
      if (dot < 0) return null
      const body = state.slice(0, dot)
      const sig = state.slice(dot + 1)

      const expected = Buffer.from(this.tag(body), 'utf8')
      const actual = Buffer.from(sig, 'utf8')
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null

      const parsed: unknown = JSON.parse(fromBase64Url(body).toString('utf8'))
      return isStatePayload(parsed) ? parsed : null
    } catch {
      return null
    }
  }

  private tag(body: string): string {
    return toBase64Url(createHmac('sha256', this.secret).update(body).digest())
  }
}

const toBase64Url = (buf: Buffer): string =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const fromBase64Url = (s: string): Buffer => {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64')
}

const isStatePayload = (v: unknown): v is OAuthStatePayload => {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return (
    typeof o.pluginName === 'string' &&
    typeof o.userId === 'string' &&
    typeof o.clientId === 'string' &&
    typeof o.clientSecret === 'string'
  )
}
