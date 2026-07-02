import { ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { SendEmail, SendEmailCommand } from '@/contexts/email/application/ports/in/SendEmail'
import { EmailAccountRepository } from '@/contexts/email/application/ports/out/EmailAccountRepository'
import { MailMemberRepository } from '@/contexts/email/application/ports/out/MailMemberRepository'
import { EmailRepository } from '@/contexts/email/application/ports/out/EmailRepository'
import { SmtpSender, OutgoingAttachment } from '@/contexts/email/application/ports/out/SmtpSender'
import { Cipher } from '@/contexts/email/application/ports/out/Cipher'
import { AttachmentStore } from '@/contexts/email/application/ports/out/AttachmentStore'
import { Email } from '@/contexts/email/domain/Email'
import { EmailAccountId } from '@/contexts/email/domain/ids'

const splitAddresses = (raw: string): string[] => raw.split(',').map((e) => e.trim()).filter(Boolean)

// Sends synchronously via SMTP (matching AEX's inline send), then stores the
// message in the Sent folder. Permission = account owner OR a member with
// canSend. Attachment bytes are read through the AttachmentStore ACL (files
// context); a traversal path is rejected before any read.
export class SendEmailService implements SendEmail {
  constructor(
    private readonly accounts: EmailAccountRepository,
    private readonly members: MailMemberRepository,
    private readonly emails: EmailRepository,
    private readonly sender: SmtpSender,
    private readonly cipher: Cipher,
    private readonly attachments: AttachmentStore,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: SendEmailCommand) {
    const account = await this.accounts.findById(EmailAccountId.of(cmd.accountId))
    const canSend = account
      ? account.isOwnedBy(cmd.actorId) || ((await this.members.find(cmd.accountId, cmd.actorId))?.canSend ?? false)
      : false
    if (!account || !canSend) {
      return fail("You don't have permission to send from this account.")
    }

    const to = splitAddresses(cmd.to)
    const cc = cmd.cc ? splitAddresses(cmd.cc) : []

    let outgoing: OutgoingAttachment[] | undefined
    if (cmd.attachments && cmd.attachments.length > 0) {
      for (const att of cmd.attachments) {
        if (att.path.includes('..')) return fail('Invalid attachment path.')
      }
      outgoing = []
      for (const att of cmd.attachments) {
        const content = await this.attachments.read(att.path)
        outgoing.push({ filename: att.name, content, contentType: att.mimeType })
      }
    }

    const settings = account.smtpSettingsCipher()
    const pass = this.cipher.decrypt(settings.pass) ?? settings.pass

    const result = await this.sender.send(
      { ...settings, pass },
      {
        to,
        cc,
        subject: cmd.subject,
        bodyHtml: cmd.body,
        inReplyTo: cmd.inReplyTo,
        attachments: outgoing,
      },
    )

    const id = this.emails.nextId()
    const email = Email.sent(
      id,
      {
        accountId: cmd.accountId,
        externalId: result.messageId || id.value,
        threadId: cmd.threadId ?? null,
        fromName: account.fromName || account.emailAddress,
        fromEmail: account.emailAddress,
        to,
        cc,
        subject: cmd.subject,
        bodyHtml: cmd.body,
      },
      this.clock.now(),
    )
    await this.emails.save(email)
    await this.events.publish(email.pullEvents())

    return ok({ success: true as const, id: id.value })
  }
}
