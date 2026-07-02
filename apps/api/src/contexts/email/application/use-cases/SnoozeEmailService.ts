import { ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { SnoozeEmail, SnoozeEmailCommand } from '@/contexts/email/application/ports/in/SnoozeEmail'
import { EmailAccountRepository } from '@/contexts/email/application/ports/out/EmailAccountRepository'
import { EmailRepository } from '@/contexts/email/application/ports/out/EmailRepository'
import { Scheduler } from '@/contexts/email/application/ports/out/Scheduler'
import { EmailId } from '@/contexts/email/domain/ids'

// Snoozes one accessible email: the aggregate marks it read and stashes the wake
// instant; the Scheduler out-port books the delayed wake job.
export class SnoozeEmailService implements SnoozeEmail {
  constructor(
    private readonly accounts: EmailAccountRepository,
    private readonly emails: EmailRepository,
    private readonly scheduler: Scheduler,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: SnoozeEmailCommand) {
    const accountIds = await this.accounts.accountIdsForUser(cmd.actorId)
    const email = await this.emails.findInAccounts(EmailId.of(cmd.id), accountIds)
    if (!email) return fail('Email not found')

    const wake = email.snooze(cmd.until, this.clock.now())
    if (!wake.ok) return fail(wake.error)

    await this.emails.save(email)
    await this.scheduler.scheduleSnoozeWake({ emailId: email.id.value, wakeAt: wake.value })
    await this.events.publish(email.pullEvents())
    return ok({ snoozedUntil: wake.value.toISOString() })
  }
}
