import { ok } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { DomainEvent } from '@/shared/kernel/DomainEvent'
import { SetReadState, SetReadStateCommand } from '@/contexts/email/application/ports/in/SetReadState'
import { EmailAccountRepository } from '@/contexts/email/application/ports/out/EmailAccountRepository'
import { EmailRepository } from '@/contexts/email/application/ports/out/EmailRepository'

// Marks a set of accessible emails read/unread (emails.markRead / markUnread).
export class SetReadStateService implements SetReadState {
  constructor(
    private readonly accounts: EmailAccountRepository,
    private readonly emails: EmailRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: SetReadStateCommand) {
    const accountIds = await this.accounts.accountIdsForUser(cmd.actorId)
    if (accountIds.length === 0) return ok({ success: true as const })

    const targets = await this.emails.findManyInAccounts(cmd.ids, accountIds)
    const now = this.clock.now()
    const drained: DomainEvent[] = []

    for (const email of targets) {
      email.setRead(cmd.read, now)
      await this.emails.save(email)
      drained.push(...email.pullEvents())
    }

    await this.events.publish(drained)
    return ok({ success: true as const })
  }
}
