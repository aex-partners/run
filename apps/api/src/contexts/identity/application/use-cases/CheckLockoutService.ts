import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { CheckLockout, CheckLockoutQuery, LockState } from '@/contexts/identity/application/ports/in/CheckLockout'
import { LoginAttemptStore } from '@/contexts/identity/application/ports/out/LoginAttemptStore'
import { Email } from '@/contexts/identity/domain/Email'
import { LOCKOUT_WINDOW_MINUTES } from '@/contexts/identity/domain/LoginAttempt'

// getLockedUntil: read-only check reflecting lock state set by PRIOR attempts
// only, so the attempt that trips the limit can still succeed.
export class CheckLockoutService implements CheckLockout {
  constructor(
    private readonly store: LoginAttemptStore,
    private readonly clock: Clock,
  ) {}

  async execute(q: CheckLockoutQuery): Promise<Result<LockState | null>> {
    const email = Email.of(q.email)
    if (!email.ok) return fail(email.error)

    const attempt = await this.store.find(email.value)
    if (!attempt) return ok(null)

    const lockedUntil = attempt.lockedUntil(this.clock.now())
    if (!lockedUntil) return ok(null)
    return ok({ lockedUntil: lockedUntil.toISOString(), windowMinutes: LOCKOUT_WINDOW_MINUTES })
  }
}
