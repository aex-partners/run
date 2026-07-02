import { ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { DeleteAccount, DeleteAccountCommand } from '@/contexts/email/application/ports/in/ManageAccount'
import { EmailAccountRepository } from '@/contexts/email/application/ports/out/EmailAccountRepository'
import { EmailAccountId } from '@/contexts/email/domain/ids'

// Owner-only account delete. The schema FKs cascade to emails and members.
export class DeleteAccountService implements DeleteAccount {
  constructor(
    private readonly accounts: EmailAccountRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: DeleteAccountCommand) {
    const account = await this.accounts.findById(EmailAccountId.of(cmd.id))
    if (!account) return fail('Account not found')
    if (!account.isOwnedBy(cmd.actorId)) return fail('Only the account owner can delete it')

    account.markDeleted(this.clock.now())
    await this.accounts.delete(account)
    await this.events.publish(account.pullEvents())
    return ok({ success: true as const })
  }
}
