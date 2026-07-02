import { ok } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { DeliverQueuedEmail } from '@/contexts/email/application/ports/in/TransactionalEmail'
import { QueuedEmail } from '@/contexts/email/application/ports/out/EmailQueue'
import { EmailAccountRepository } from '@/contexts/email/application/ports/out/EmailAccountRepository'
import { EmailRepository } from '@/contexts/email/application/ports/out/EmailRepository'
import { SmtpSender } from '@/contexts/email/application/ports/out/SmtpSender'
import { Cipher } from '@/contexts/email/application/ports/out/Cipher'
import { Email } from '@/contexts/email/domain/Email'
import { EmailAccountId } from '@/contexts/email/domain/ids'

// Driven by the EmailWorker: load the sender account, send via SMTP, and persist
// to the Sent folder unless storeSent is false (AEX email-worker.ts). A missing
// account is skipped (the worker logged and returned).
export class DeliverQueuedEmailService implements DeliverQueuedEmail {
  constructor(
    private readonly accounts: EmailAccountRepository,
    private readonly emails: EmailRepository,
    private readonly sender: SmtpSender,
    private readonly cipher: Cipher,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(job: QueuedEmail) {
    const account = await this.accounts.findById(EmailAccountId.of(job.accountId))
    if (!account) return ok({ delivered: false })

    const settings = account.smtpSettingsCipher()
    const pass = this.cipher.decrypt(settings.pass) ?? settings.pass

    const result = await this.sender.send(
      { ...settings, pass },
      {
        to: job.to,
        cc: job.cc,
        subject: job.subject,
        bodyHtml: job.bodyHtml,
        bodyText: job.bodyText,
        fromName: job.fromName,
        replyTo: job.replyTo,
        inReplyTo: job.inReplyTo,
      },
    )

    if (job.storeSent !== false) {
      const id = this.emails.nextId()
      const email = Email.sent(
        id,
        {
          accountId: job.accountId,
          externalId: result.messageId || id.value,
          threadId: null,
          fromName: job.fromName || account.fromName || account.emailAddress,
          fromEmail: account.emailAddress,
          to: job.to,
          cc: job.cc ?? [],
          subject: job.subject,
          bodyHtml: job.bodyHtml,
        },
        this.clock.now(),
      )
      await this.emails.save(email)
      await this.events.publish(email.pullEvents())
    }

    return ok({ delivered: true })
  }
}
