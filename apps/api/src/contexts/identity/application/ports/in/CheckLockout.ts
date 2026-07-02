import { Result } from '@/shared/kernel/Result'

// Read-only lock check, called by the sign-in before-hook before registering the
// attempt. Returns the active lock expiry (ISO string) and the window length the
// caller uses to build the "try again in N minutes" message, or null when the
// account is not locked.
export interface CheckLockoutQuery {
  email: string
}

export interface LockState {
  lockedUntil: string
  windowMinutes: number
}

export interface CheckLockout {
  execute(q: CheckLockoutQuery): Promise<Result<LockState | null>>
}
