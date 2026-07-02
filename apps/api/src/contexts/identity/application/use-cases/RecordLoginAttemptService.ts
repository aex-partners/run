import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { RecordLoginAttempt, RecordLoginAttemptCommand } from '@/contexts/identity/application/ports/in/RecordLoginAttempt'
import { LoginAttemptStore } from '@/contexts/identity/application/ports/out/LoginAttemptStore'
import { Email } from '@/contexts/identity/domain/Email'
import { LoginAttempt } from '@/contexts/identity/domain/LoginAttempt'

// registerLoginAttempt: optimistic increment on every sign-in attempt. The
// sliding-window decision is pure (the aggregate); this service only loads,
// applies, and persists.
export class RecordLoginAttemptService implements RecordLoginAttempt {
  constructor(
    private readonly store: LoginAttemptStore,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: RecordLoginAttemptCommand): Promise<Result<void>> {
    const email = Email.of(cmd.email)
    if (!email.ok) return fail(email.error)

    const attempt = (await this.store.find(email.value)) ?? LoginAttempt.fresh(email.value)
    attempt.register(this.clock.now())
    await this.store.save(attempt)
    return ok(undefined)
  }
}
