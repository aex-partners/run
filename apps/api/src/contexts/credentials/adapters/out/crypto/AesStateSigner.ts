import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import {
  StateSigner,
  OAuthStatePayload,
} from '@/contexts/credentials/application/ports/out/StateSigner'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const TAG_LENGTH = 16

// Driven adapter for the StateSigner port using AES-256-GCM, matching the source
// behavior. Unlike the HMAC signer, this keeps the payload CONFIDENTIAL — the
// OAuth `state` carries the client secret, so it must be encrypted, not merely
// signed. GCM also authenticates (tamper-evident), so `verify` rejects a forged
// or modified state. Token = base64url(iv ‖ ciphertext ‖ authTag). Key injected
// from ENCRYPTION_KEY (32 raw or 64 hex chars) in main.
export class AesStateSigner implements StateSigner {
  private readonly key: Buffer

  constructor(key: string) {
    if (key.length === 64) this.key = Buffer.from(key, 'hex')
    else if (key.length === 32) this.key = Buffer.from(key, 'utf8')
    else throw new Error('AesStateSigner: key must be 32 bytes (or 64 hex characters)')
  }

  sign(payload: OAuthStatePayload): string {
    const iv = randomBytes(IV_LENGTH)
    const cipher = createCipheriv(ALGORITHM, this.key, iv)
    const encrypted = Buffer.concat([
      cipher.update(JSON.stringify(payload), 'utf8'),
      cipher.final(),
    ])
    const tag = cipher.getAuthTag()
    return toBase64Url(Buffer.concat([iv, encrypted, tag]))
  }

  verify(state: string): OAuthStatePayload | null {
    try {
      const combined = fromBase64Url(state)
      if (combined.length < IV_LENGTH + TAG_LENGTH) return null
      const iv = combined.subarray(0, IV_LENGTH)
      const tag = combined.subarray(combined.length - TAG_LENGTH)
      const ciphertext = combined.subarray(IV_LENGTH, combined.length - TAG_LENGTH)
      const decipher = createDecipheriv(ALGORITHM, this.key, iv)
      decipher.setAuthTag(tag)
      const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
      const parsed: unknown = JSON.parse(plain)
      return isStatePayload(parsed) ? parsed : null
    } catch {
      return null
    }
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
