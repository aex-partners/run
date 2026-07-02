import { describe, it, expect } from 'vitest'
import {
  LoginAttempt,
  MAX_LOGIN_ATTEMPTS,
  LOCKOUT_WINDOW_MINUTES,
} from '@/contexts/identity/domain/LoginAttempt'
import { Email } from '@/contexts/identity/domain/Email'

const WINDOW_MS = LOCKOUT_WINDOW_MINUTES * 60_000
const email = Email.fromTrusted('user@example.com')
// A reference "now" well past the unix epoch so the first register() always
// takes the stale branch (lastAttemptAt starts at epoch 0).
const T0 = new Date('2026-06-29T12:00:00.000Z')
const at = (msOffset: number) => new Date(T0.getTime() + msOffset)

describe('LoginAttempt sliding-window lockout', () => {
  it('starts fresh with zero attempts and no lock', () => {
    const a = LoginAttempt.fresh(email)
    expect(a.attempts).toBe(0)
    expect(a.lockedUntilRaw).toBeNull()
    expect(a.lockedUntil(T0)).toBeNull()
  })

  it('first register() resets to a single attempt (stale branch from the epoch)', () => {
    const a = LoginAttempt.fresh(email)
    a.register(T0)
    expect(a.attempts).toBe(1)
    expect(a.lockedUntilRaw).toBeNull()
    expect(a.lastAttemptAt).toEqual(T0)
  })

  it('increments on each successive attempt inside the window', () => {
    const a = LoginAttempt.fresh(email)
    a.register(at(0))
    a.register(at(1_000))
    a.register(at(2_000))
    expect(a.attempts).toBe(3)
    expect(a.lockedUntil(at(2_000))).toBeNull()
  })

  it('does not lock until the 5th attempt within the window', () => {
    const a = LoginAttempt.fresh(email)
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS - 1; i++) a.register(at(i * 1_000))
    expect(a.attempts).toBe(4)
    expect(a.lockedUntil(at(5_000))).toBeNull()
  })

  it('arms the lock for one window once the 5th attempt lands', () => {
    const a = LoginAttempt.fresh(email)
    let last = 0
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS; i++) {
      last = i * 1_000
      a.register(at(last))
    }
    expect(a.attempts).toBe(MAX_LOGIN_ATTEMPTS)
    const locked = a.lockedUntil(at(last))
    expect(locked).not.toBeNull()
    // Lock expiry is the last attempt time plus a full window.
    expect(locked?.getTime()).toBe(at(last).getTime() + WINDOW_MS)
  })

  it('lockedUntil() returns null once the lock has expired', () => {
    const a = LoginAttempt.fresh(email)
    let last = 0
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS; i++) {
      last = i * 1_000
      a.register(at(last))
    }
    const lockedUntil = a.lockedUntilRaw!
    // One millisecond before expiry -> still locked.
    expect(a.lockedUntil(new Date(lockedUntil.getTime() - 1))).not.toBeNull()
    // At/after expiry -> no longer locked.
    expect(a.lockedUntil(new Date(lockedUntil.getTime()))).toBeNull()
    expect(a.lockedUntil(new Date(lockedUntil.getTime() + 1))).toBeNull()
  })

  it('resets the count to 1 when the next attempt is past the window (stale reset)', () => {
    const a = LoginAttempt.fresh(email)
    a.register(at(0))
    a.register(at(1_000))
    expect(a.attempts).toBe(2)
    // A gap strictly larger than the window resets the window.
    a.register(at(1_000 + WINDOW_MS + 1))
    expect(a.attempts).toBe(1)
    expect(a.lockedUntilRaw).toBeNull()
  })

  it('treats a gap exactly equal to the window as NOT stale (boundary is strictly greater)', () => {
    const a = LoginAttempt.fresh(email)
    a.register(at(0))
    // Exactly WINDOW_MS later: now - last == WINDOW_MS, not > WINDOW_MS.
    a.register(at(WINDOW_MS))
    expect(a.attempts).toBe(2)
  })

  it('clears a prior lock after the window elapses and a fresh attempt arrives', () => {
    const a = LoginAttempt.fresh(email)
    let last = 0
    for (let i = 0; i < MAX_LOGIN_ATTEMPTS; i++) {
      last = i * 1_000
      a.register(at(last))
    }
    expect(a.lockedUntilRaw).not.toBeNull()
    // Next attempt arrives well after the window -> stale branch clears the lock.
    a.register(at(last + WINDOW_MS + 10_000))
    expect(a.attempts).toBe(1)
    expect(a.lockedUntilRaw).toBeNull()
  })

  it('rehydrate() restores stored window state verbatim', () => {
    const lastAttemptAt = at(5_000)
    const lockedUntil = at(5_000 + WINDOW_MS)
    const a = LoginAttempt.rehydrate({
      email: email.value,
      attempts: MAX_LOGIN_ATTEMPTS,
      lastAttemptAt,
      lockedUntil,
    })
    expect(a.attempts).toBe(MAX_LOGIN_ATTEMPTS)
    expect(a.lastAttemptAt).toEqual(lastAttemptAt)
    expect(a.lockedUntilRaw).toEqual(lockedUntil)
    expect(a.lockedUntil(at(5_000))).toEqual(lockedUntil)
  })

  it('keys the aggregate id by the normalized email', () => {
    const a = LoginAttempt.fresh(email)
    expect(a.id.value).toBe(email.value)
  })
})
