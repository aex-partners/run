import { Result, ok, fail } from '@/shared/kernel/Result'
import { UnlockAccount, UnlockAccountCommand } from '@/contexts/identity/application/ports/in/UnlockAccount'
import { LoginAttemptStore } from '@/contexts/identity/application/ports/out/LoginAttemptStore'
import { UserRepository } from '@/contexts/identity/application/ports/out/UserRepository'
import { AuditTrail } from '@/contexts/identity/application/ports/out/AuditTrail'
import { Email } from '@/contexts/identity/domain/Email'
import { UserId } from '@/contexts/identity/domain/UserId'

// users.unlockAccount (admin, D4). Clears lockout state for an email (same effect
// as a reset) and records the audit row. resourceId is null because the unlock is
// keyed by email, not by a known user id.
export class UnlockAccountService implements UnlockAccount {
  constructor(
    private readonly store: LoginAttemptStore,
    private readonly users: UserRepository,
    private readonly audit: AuditTrail,
  ) {}

  async execute(cmd: UnlockAccountCommand): Promise<Result<{ success: true }>> {
    const email = Email.of(cmd.email)
    if (!email.ok) return fail(email.error)

    await this.store.delete(email.value)

    const actor = await this.users.findById(UserId.of(cmd.actorId))
    await this.audit.record({
      actorId: cmd.actorId,
      actorEmail: actor?.email.value ?? null,
      action: 'user.unlocked',
      resourceType: 'user',
      resourceId: null,
      metadata: { email: email.value.value },
    })

    return ok({ success: true })
  }
}
