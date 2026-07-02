import { ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { UpdateAccount, UpdateAccountCommand } from '@/contexts/email/application/ports/in/ManageAccount'
import { EmailAccountRepository } from '@/contexts/email/application/ports/out/EmailAccountRepository'
import { Cipher } from '@/contexts/email/application/ports/out/Cipher'
import { EmailAccountId } from '@/contexts/email/domain/ids'

// Owner-only account edit. A supplied password is re-encrypted; an absent one
// leaves the stored ciphertext untouched.
export class UpdateAccountService implements UpdateAccount {
  constructor(
    private readonly accounts: EmailAccountRepository,
    private readonly cipher: Cipher,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: UpdateAccountCommand) {
    const account = await this.accounts.findById(EmailAccountId.of(cmd.id))
    if (!account) return fail('Account not found')
    if (!account.isOwnedBy(cmd.actorId)) return fail('Only the account owner can edit it')

    const updated = account.update(
      {
        displayName: cmd.displayName,
        emailAddress: cmd.emailAddress,
        fromName: cmd.fromName,
        smtpHost: cmd.smtpHost,
        smtpPort: cmd.smtpPort,
        smtpUser: cmd.smtpUser,
        smtpPassCipher: cmd.smtpPass !== undefined ? this.cipher.encrypt(cmd.smtpPass) : undefined,
        smtpSecure: cmd.smtpSecure,
        isShared: cmd.isShared,
      },
      this.clock.now(),
    )
    if (!updated.ok) return fail(updated.error)

    await this.accounts.save(account)
    await this.events.publish(account.pullEvents())
    return ok({ success: true as const })
  }
}
