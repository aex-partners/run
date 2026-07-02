import { ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { RemoveMember, RemoveMemberCommand } from '@/contexts/email/application/ports/in/ManageMembers'
import { EmailAccountRepository } from '@/contexts/email/application/ports/out/EmailAccountRepository'
import { MailMemberRepository } from '@/contexts/email/application/ports/out/MailMemberRepository'
import { EmailAccountId } from '@/contexts/email/domain/ids'

// Owner-only: revoke a member. The owner can never be removed from their own
// account.
export class RemoveMemberService implements RemoveMember {
  constructor(
    private readonly accounts: EmailAccountRepository,
    private readonly members: MailMemberRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: RemoveMemberCommand) {
    const account = await this.accounts.findById(EmailAccountId.of(cmd.accountId))
    if (!account) return fail('Account not found')
    if (!account.isOwnedBy(cmd.actorId)) return fail('Only the account owner can manage members')
    if (cmd.userId === account.ownerId) return fail('Cannot remove the owner from the account')

    const member = await this.members.find(cmd.accountId, cmd.userId)
    if (member) {
      member.markRemoved(this.clock.now())
      await this.members.delete(member)
      await this.events.publish(member.pullEvents())
    }
    return ok({ success: true as const })
  }
}
