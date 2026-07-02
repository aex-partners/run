import { ok } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { WakeSnoozedEmail, WakeSnoozedEmailCommand } from '@/contexts/email/application/ports/in/SnoozeEmail'
import { EmailRepository } from '@/contexts/email/application/ports/out/EmailRepository'
import { EmailId } from '@/contexts/email/domain/ids'

// Driven by the SnoozeWorker when a wake job fires: returns the email to the
// inbox, unread, marker dropped. Idempotent — a missing email is a no-op.
export class WakeSnoozedEmailService implements WakeSnoozedEmail {
  constructor(
    private readonly emails: EmailRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: WakeSnoozedEmailCommand) {
    const email = await this.emails.findById(EmailId.of(cmd.emailId))
    if (!email) return ok({ awakened: false })

    email.unsnooze(this.clock.now())
    await this.emails.save(email)
    await this.events.publish(email.pullEvents())
    return ok({ awakened: true })
  }
}
