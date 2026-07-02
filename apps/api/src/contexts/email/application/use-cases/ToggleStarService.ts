import { ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { ToggleStar, ToggleStarCommand } from '@/contexts/email/application/ports/in/ToggleStar'
import { EmailAccountRepository } from '@/contexts/email/application/ports/out/EmailAccountRepository'
import { EmailRepository } from '@/contexts/email/application/ports/out/EmailRepository'
import { EmailId } from '@/contexts/email/domain/ids'

// Flips the starred flag on one accessible email (emails.star).
export class ToggleStarService implements ToggleStar {
  constructor(
    private readonly accounts: EmailAccountRepository,
    private readonly emails: EmailRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: ToggleStarCommand) {
    const accountIds = await this.accounts.accountIdsForUser(cmd.actorId)
    const email = await this.emails.findInAccounts(EmailId.of(cmd.id), accountIds)
    if (!email) return fail('Email not found')

    email.toggleStar(this.clock.now())
    await this.emails.save(email)
    await this.events.publish(email.pullEvents())
    return ok({ starred: email.starred })
  }
}
