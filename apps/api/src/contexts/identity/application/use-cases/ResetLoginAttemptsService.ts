import { Result, ok, fail } from '@/shared/kernel/Result'
import { ResetLoginAttempts, ResetLoginAttemptsCommand } from '@/contexts/identity/application/ports/in/ResetLoginAttempts'
import { LoginAttemptStore } from '@/contexts/identity/application/ports/out/LoginAttemptStore'
import { Email } from '@/contexts/identity/domain/Email'

// resetLoginAttempts: clear accumulated lockout state on a successful sign-in.
export class ResetLoginAttemptsService implements ResetLoginAttempts {
  constructor(private readonly store: LoginAttemptStore) {}

  async execute(cmd: ResetLoginAttemptsCommand): Promise<Result<void>> {
    const email = Email.of(cmd.email)
    if (!email.ok) return fail(email.error)
    await this.store.delete(email.value)
    return ok(undefined)
  }
}
