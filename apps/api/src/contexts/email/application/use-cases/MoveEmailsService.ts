import { ok } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { DomainEvent } from '@/shared/kernel/DomainEvent'
import { MoveEmails, MoveEmailsCommand } from '@/contexts/email/application/ports/in/MoveEmails'
import { EmailAccountRepository } from '@/contexts/email/application/ports/out/EmailAccountRepository'
import { EmailRepository } from '@/contexts/email/application/ports/out/EmailRepository'

// Moves a set of accessible emails to a target folder (archive / trash / spam).
// Out-of-scope ids are silently skipped — the ownership filter is the
// findManyInAccounts query, mirroring AEX's WHERE id IN ... AND accountId IN ...
export class MoveEmailsService implements MoveEmails {
  constructor(
    private readonly accounts: EmailAccountRepository,
    private readonly emails: EmailRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: MoveEmailsCommand) {
    const accountIds = await this.accounts.accountIdsForUser(cmd.actorId)
    if (accountIds.length === 0) return ok({ success: true as const })

    const targets = await this.emails.findManyInAccounts(cmd.ids, accountIds)
    const now = this.clock.now()
    const drained: DomainEvent[] = []

    for (const email of targets) {
      email.moveTo(cmd.folder, now)
      await this.emails.save(email)
      drained.push(...email.pullEvents())
    }

    await this.events.publish(drained)
    return ok({ success: true as const })
  }
}
