import { ok } from '@/shared/kernel/Result'
import {
  SendTransactionalEmail,
  SendTransactionalEmailCommand,
} from '@/contexts/email/application/ports/in/TransactionalEmail'
import { TemplateName } from '@/contexts/email/application/ports/out/EmailTemplateRenderer'
import { EmailTemplateRenderer } from '@/contexts/email/application/ports/out/EmailTemplateRenderer'
import { MailSettings } from '@/contexts/email/application/ports/out/MailSettings'
import { EmailQueue } from '@/contexts/email/application/ports/out/EmailQueue'

// The capability the email context exposes to auth/notifications: render a typed
// template and enqueue it on the system account. Fail-soft — an unconfigured
// system account returns {sent:false} rather than throwing, so a signup/reset
// flow never breaks (AEX email-engine/index.ts). Transactional mail is
// fire-and-forget (storeSent:false), never kept in a Sent folder.
export class SendTransactionalEmailService implements SendTransactionalEmail {
  constructor(
    private readonly settings: MailSettings,
    private readonly renderer: EmailTemplateRenderer,
    private readonly queue: EmailQueue,
  ) {}

  async execute<N extends TemplateName>(cmd: SendTransactionalEmailCommand<N>) {
    const accountId = await this.settings.systemEmailAccountId()
    if (!accountId) {
      return ok({ sent: false, reason: 'no-system-account' as const })
    }

    const locale = cmd.locale ?? (await this.settings.emailLocale())
    const rendered = this.renderer.render(cmd.template, cmd.data, locale)

    await this.queue.enqueue({
      accountId,
      storeSent: false,
      to: [cmd.to],
      subject: rendered.subject,
      bodyHtml: rendered.bodyHtml,
      bodyText: rendered.bodyText,
    })

    return ok({ sent: true })
  }
}
