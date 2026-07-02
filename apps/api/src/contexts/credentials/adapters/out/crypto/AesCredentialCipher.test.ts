import { describe, it, expect } from 'vitest'
import { AesCredentialCipher } from '@/contexts/credentials/adapters/out/crypto/AesCredentialCipher'

// 64 hex chars -> 32 raw bytes (AES-256).
const HEX_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
const RAW_KEY = 'abcdefghijklmnopqrstuvwxyz012345' // exactly 32 chars

describe('AesCredentialCipher', () => {
  it('round-trips encrypt/decrypt with a 64-hex key', () => {
    const cipher = new AesCredentialCipher(HEX_KEY)
    const plaintext = JSON.stringify({ token: 'super-secret', n: 42 })
    const encoded = cipher.encrypt(plaintext)
    expect(encoded).not.toContain('super-secret') // value is not stored in clear
    expect(cipher.decrypt(encoded)).toBe(plaintext)
  })

  it('round-trips with a 32-char raw key', () => {
    const cipher = new AesCredentialCipher(RAW_KEY)
    const plaintext = 'hello world'
    expect(cipher.decrypt(cipher.encrypt(plaintext))).toBe(plaintext)
  })

  it('produces a different ciphertext each time (random IV) but decrypts to the same value', () => {
    const cipher = new AesCredentialCipher(HEX_KEY)
    const a = cipher.encrypt('same input')
    const b = cipher.encrypt('same input')
    expect(a).not.toBe(b)
    expect(cipher.decrypt(a)).toBe('same input')
    expect(cipher.decrypt(b)).toBe('same input')
  })

  it('handles unicode and empty payloads', () => {
    const cipher = new AesCredentialCipher(HEX_KEY)
    for (const s of ['', 'café ☕ — naïve', '日本語']) {
      expect(cipher.decrypt(cipher.encrypt(s))).toBe(s)
    }
  })

  it('throws when the ciphertext is tampered (GCM auth tag mismatch)', () => {
    const cipher = new AesCredentialCipher(HEX_KEY)
    const encoded = cipher.encrypt('integrity matters')
    const buf = Buffer.from(encoded, 'base64')
    // Flip a bit in the ciphertext body (past the 12-byte IV).
    buf[13] = (buf[13] ?? 0) ^ 0xff
    const tampered = buf.toString('base64')
    expect(() => cipher.decrypt(tampered)).toThrow()
  })

  it('throws when the auth tag is tampered', () => {
    const cipher = new AesCredentialCipher(HEX_KEY)
    const buf = Buffer.from(cipher.encrypt('integrity matters'), 'base64')
    const last = buf.length - 1
    buf[last] = (buf[last] ?? 0) ^ 0xff // last byte is part of the 16-byte tag
    expect(() => cipher.decrypt(buf.toString('base64'))).toThrow()
  })

  it('throws when decrypting with the wrong key', () => {
    const a = new AesCredentialCipher(HEX_KEY)
    const other = new AesCredentialCipher(
      'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    )
    expect(() => other.decrypt(a.encrypt('secret'))).toThrow()
  })

  it('rejects a key that is neither 32 nor 64 chars', () => {
    expect(() => new AesCredentialCipher('too-short')).toThrow()
  })
})
