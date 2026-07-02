import { describe, it, expect } from 'vitest'
import {
  CredentialResolution,
  CredentialCandidate,
} from '@/contexts/credentials/domain/CredentialResolution'

const cand = (over: Partial<CredentialCandidate> & { id: string }): CredentialCandidate => ({
  isPrimary: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  status: 'active',
  ...over,
})

const day = (n: number) => new Date(Date.UTC(2026, 0, n))

describe('CredentialResolution.select precedence (explicit > primary > oldest)', () => {
  it('returns null for an empty candidate set', () => {
    expect(CredentialResolution.select([], null)).toBeNull()
  })

  it('an explicitly requested id always wins', () => {
    const set = [
      cand({ id: 'a', isPrimary: true, createdAt: day(1) }),
      cand({ id: 'b', createdAt: day(2) }),
    ]
    expect(CredentialResolution.select(set, 'b')?.id).toBe('b')
  })

  it('explicit id wins even over the primary/oldest rule', () => {
    const set = [
      cand({ id: 'primary', isPrimary: true, createdAt: day(5) }),
      cand({ id: 'oldest', createdAt: day(1) }),
      cand({ id: 'chosen', createdAt: day(3) }),
    ]
    expect(CredentialResolution.select(set, 'chosen')?.id).toBe('chosen')
  })

  it('explicit id is returned even when that credential is not active', () => {
    const set = [cand({ id: 'broken', status: 'error', createdAt: day(1) })]
    expect(CredentialResolution.select(set, 'broken')?.id).toBe('broken')
  })

  it('returns null when the explicit id is not present', () => {
    const set = [cand({ id: 'a' })]
    expect(CredentialResolution.select(set, 'missing')).toBeNull()
  })

  it('without an explicit id, the active primary wins over an older non-primary', () => {
    const set = [
      cand({ id: 'old', createdAt: day(1) }),
      cand({ id: 'primary', isPrimary: true, createdAt: day(9) }),
    ]
    expect(CredentialResolution.select(set, null)?.id).toBe('primary')
  })

  it('falls back to the oldest active when no candidate is primary', () => {
    const set = [
      cand({ id: 'newest', createdAt: day(3) }),
      cand({ id: 'oldest', createdAt: day(1) }),
      cand({ id: 'middle', createdAt: day(2) }),
    ]
    expect(CredentialResolution.select(set, null)?.id).toBe('oldest')
  })

  it('excludes non-active candidates from the implicit selection', () => {
    const set = [
      cand({ id: 'errored', status: 'error', createdAt: day(1) }),
      cand({ id: 'missing', status: 'missing', isPrimary: true, createdAt: day(2) }),
      cand({ id: 'active', createdAt: day(5) }),
    ]
    // Only the active one is eligible even though it is the newest and not primary.
    expect(CredentialResolution.select(set, null)?.id).toBe('active')
  })

  it('returns null when no candidate is active', () => {
    const set = [
      cand({ id: 'errored', status: 'error' }),
      cand({ id: 'missing', status: 'missing' }),
    ]
    expect(CredentialResolution.select(set, null)).toBeNull()
  })

  it('does not mutate the input ordering', () => {
    const set = [
      cand({ id: 'newest', createdAt: day(3) }),
      cand({ id: 'oldest', createdAt: day(1) }),
    ]
    CredentialResolution.select(set, null)
    expect(set.map((c) => c.id)).toEqual(['newest', 'oldest'])
  })
})
