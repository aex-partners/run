import { describe, it, expect } from 'vitest'
import { AesStateSigner } from '@/contexts/credentials/adapters/out/crypto/AesStateSigner'
import { OAuthStatePayload } from '@/contexts/credentials/application/ports/out/StateSigner'

const HEX_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
const RAW_KEY = 'abcdefghijklmnopqrstuvwxyz012345'

const payload: OAuthStatePayload = {
  pluginName: 'erp',
  userId: 'user-1',
  clientId: 'client-123',
  clientSecret: 'sh-secret',
}

describe('AesStateSigner', () => {
  it('round-trips sign/verify with a 64-hex key', () => {
    const signer = new AesStateSigner(HEX_KEY)
    const state = signer.sign(payload)
    expect(signer.verify(state)).toEqual(payload)
  })

  it('round-trips with a 32-char raw key', () => {
    const signer = new AesStateSigner(RAW_KEY)
    expect(signer.verify(signer.sign(payload))).toEqual(payload)
  })

  it('keeps the secret confidential (not present in the URL-safe token)', () => {
    const signer = new AesStateSigner(HEX_KEY)
    const state = signer.sign(payload)
    expect(state).not.toContain('sh-secret')
    // URL-safe: no +, /, or = characters.
    expect(state).not.toMatch(/[+/=]/)
  })

  it('verify returns null for a tampered state (GCM auth fails)', () => {
    const signer = new AesStateSigner(HEX_KEY)
    const state = signer.sign(payload)
    // Flip a character in the middle of the token.
    const mid = Math.floor(state.length / 2)
    const swapped = state[mid] === 'A' ? 'B' : 'A'
    const tampered = state.slice(0, mid) + swapped + state.slice(mid + 1)
    expect(signer.verify(tampered)).toBeNull()
  })

  it('verify returns null for a state signed with a different key', () => {
    const a = new AesStateSigner(HEX_KEY)
    const b = new AesStateSigner(
      'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    )
    expect(b.verify(a.sign(payload))).toBeNull()
  })

  it('verify returns null for garbage / too-short input', () => {
    const signer = new AesStateSigner(HEX_KEY)
    expect(signer.verify('')).toBeNull()
    expect(signer.verify('not-a-valid-token')).toBeNull()
    expect(signer.verify('AAAA')).toBeNull() // shorter than IV+tag
  })

  it('rejects a key that is neither 32 nor 64 chars', () => {
    expect(() => new AesStateSigner('short')).toThrow()
  })
})
