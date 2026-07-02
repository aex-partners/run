import { describe, it, expect } from 'vitest'
import {
  LoginAttemptMapper,
  LoginAttemptRow,
} from '@/contexts/identity/application/mappers/LoginAttemptMapper'

const LAST = new Date('2026-06-29T12:00:00.000Z')
const LOCK = new Date('2026-06-29T12:15:00.000Z')

const row = (over: Partial<LoginAttemptRow> = {}): LoginAttemptRow => ({
  email: 'user@example.com',
  attempts: 3,
  lastAttemptAt: LAST,
  lockedUntil: null,
  ...over,
})

describe('LoginAttemptMapper.toDomain', () => {
  it('maps a row with no active lock', () => {
    const a = LoginAttemptMapper.toDomain(row())
    expect(a.id.value).toBe('user@example.com')
    expect(a.attempts).toBe(3)
    expect(a.lastAttemptAt).toEqual(LAST)
    expect(a.lockedUntilRaw).toBeNull()
  })

  it('maps a row carrying a lock timestamp', () => {
    const a = LoginAttemptMapper.toDomain(row({ attempts: 5, lockedUntil: LOCK }))
    expect(a.attempts).toBe(5)
    expect(a.lockedUntilRaw).toEqual(LOCK)
    // The stored lock is honored relative to a "now" before it expires.
    expect(a.lockedUntil(LAST)).toEqual(LOCK)
  })
})

describe('LoginAttemptMapper.toPersistence', () => {
  it('keys the row by the normalized email and preserves a null lock', () => {
    const out = LoginAttemptMapper.toPersistence(LoginAttemptMapper.toDomain(row()))
    expect(out).toEqual(row())
    expect(out.lockedUntil).toBeNull()
  })

  it('preserves a set lock value', () => {
    const r = row({ attempts: 5, lockedUntil: LOCK })
    const out = LoginAttemptMapper.toPersistence(LoginAttemptMapper.toDomain(r))
    expect(out.lockedUntil).toEqual(LOCK)
  })
})

describe('LoginAttemptMapper round-trip', () => {
  it('is identity for a locked row', () => {
    const r = row({ attempts: 5, lockedUntil: LOCK })
    expect(LoginAttemptMapper.toPersistence(LoginAttemptMapper.toDomain(r))).toEqual(r)
  })

  it('is identity for an unlocked row', () => {
    const r = row()
    expect(LoginAttemptMapper.toPersistence(LoginAttemptMapper.toDomain(r))).toEqual(r)
  })
})
