import { ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { AddMember, AddMemberCommand } from '@/contexts/email/application/ports/in/ManageMembers'
import { EmailAccountRepository } from '@/contexts/email/application/ports/out/EmailAccountRepository'
import { MailMemberRepository } from '@/contexts/email/application/ports/out/MailMemberRepository'
import { MailAccountMember } from '@/contexts/email/domain/MailAccountMember'
import { EmailAccountId } from '@/contexts/email/domain/ids'

// Owner-only: grant a user membership of a shared account. Upserts canSend
// (AEX's onConflictDoUpdate), so re-adding flips the permission rather than
// failing.
export class AddMemberService implements AddMember {
  constructor(
    private readonly accounts: EmailAccountRepository,
    private readonly members: MailMemberRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: AddMemberCommand) {
    const account = await this.accounts.findById(EmailAccountId.of(cmd.accountId))
    if (!account) return fail('Account not found')
    if (!account.isOwnedBy(cmd.actorId)) return fail('Only the account owner can manage members')
    if (!account.isShared) return fail('Account is not shared')

    const member = MailAccountMember.create(cmd.accountId, cmd.userId, cmd.canSend, this.clock.now())
    await this.members.save(member)
    await this.events.publish(member.pullEvents())
    return ok({ success: true as const })
  }
}
