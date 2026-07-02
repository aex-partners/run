import { LoginAttempt, LoginAttemptSnapshot } from '@/contexts/identity/domain/LoginAttempt'

// Persistence row shape of the `login_attempts` table (timestamptz columns).
export interface LoginAttemptRow {
  email: string
  attempts: number
  lastAttemptAt: Date
  lockedUntil: Date | null
}

export const LoginAttemptMapper = {
  toDomain(row: LoginAttemptRow): LoginAttempt {
    const snapshot: LoginAttemptSnapshot = {
      email: row.email,
      attempts: row.attempts,
      lastAttemptAt: row.lastAttemptAt,
      lockedUntil: row.lockedUntil,
    }
    return LoginAttempt.rehydrate(snapshot)
  },

  toPersistence(attempt: LoginAttempt): LoginAttemptRow {
    return {
      email: attempt.id.value,
      attempts: attempt.attempts,
      lastAttemptAt: attempt.lastAttemptAt,
      lockedUntil: attempt.lockedUntilRaw,
    }
  },
}
