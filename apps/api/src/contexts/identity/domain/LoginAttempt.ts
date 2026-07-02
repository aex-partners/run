import { AggregateRoot } from '@/shared/kernel/AggregateRoot'
import { LoginAttemptId } from '@/contexts/identity/domain/LoginAttemptId'
import { Email } from '@/contexts/identity/domain/Email'

// Lockout policy, ported from auth/lockout.ts: 5 failed attempts inside a 15-min
// sliding window locks the account for the next 15 min.
export const MAX_LOGIN_ATTEMPTS = 5
export const LOCKOUT_WINDOW_MINUTES = 15
const WINDOW_MS = LOCKOUT_WINDOW_MINUTES * 60_000

export interface LoginAttemptSnapshot {
  email: string
  attempts: number
  lastAttemptAt: Date
  lockedUntil: Date | null
}

// AGGREGATE keyed by the normalized email. The sliding-window math that the
// source did atomically in a single SQL UPSERT is reimplemented here as PURE
// state transitions (decide on in-memory state); the store turns load -> mutate
// -> save into persistence. Determinism is the point: a fake clock makes the
// window reproducible in tests.
export class LoginAttempt extends AggregateRoot<LoginAttemptId> {
  private constructor(
    id: LoginAttemptId,
    private _attempts: number,
    private _lastAttemptAt: Date,
    private _lockedUntil: Date | null,
  ) {
    super(id)
  }

  // A never-seen email. lastAttemptAt at the epoch makes the first register()
  // take the "stale window" branch and reset the count to 1, matching the SQL
  // INSERT path (attempts = 1, locked_until = NULL).
  static fresh(email: Email): LoginAttempt {
    return new LoginAttempt(LoginAttemptId.of(email.value), 0, new Date(0), null)
  }

  static rehydrate(s: LoginAttemptSnapshot): LoginAttempt {
    return new LoginAttempt(LoginAttemptId.of(s.email), s.attempts, s.lastAttemptAt, s.lockedUntil)
  }

  // Optimistic increment run on every sign-in attempt before password
  // verification. A stale row (last attempt older than the window) resets to a
  // fresh count; reaching the max arms the lock for the next window.
  register(now: Date): void {
    const stale = now.getTime() - this._lastAttemptAt.getTime() > WINDOW_MS
    if (stale) {
      this._attempts = 1
      this._lockedUntil = null
    } else {
      this._attempts += 1
      if (this._attempts >= MAX_LOGIN_ATTEMPTS) {
        this._lockedUntil = new Date(now.getTime() + WINDOW_MS)
      }
    }
    this._lastAttemptAt = now
  }

  // Throw-free lock check. Returns the active lock expiry, or null when not
  // currently locked. Reflects lock state set by PRIOR attempts only.
  lockedUntil(now: Date): Date | null {
    if (this._lockedUntil && this._lockedUntil.getTime() > now.getTime()) {
      return this._lockedUntil
    }
    return null
  }

  get attempts(): number {
    return this._attempts
  }
  get lastAttemptAt(): Date {
    return this._lastAttemptAt
  }
  // Raw stored lock value (regardless of expiry) for the mapper. Use
  // lockedUntil(now) for the policy decision.
  get lockedUntilRaw(): Date | null {
    return this._lockedUntil
  }
}
