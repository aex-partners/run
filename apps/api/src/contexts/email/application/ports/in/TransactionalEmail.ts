import { Result } from '@/shared/kernel/Result'
import { TemplateData, TemplateName, EmailLocale } from '@/contexts/email/application/ports/out/EmailTemplateRenderer'
import { QueuedEmail } from '@/contexts/email/application/ports/out/EmailQueue'

// Driving port the email context EXPOSES to other contexts (auth, notifications)
// for transactional mail. Ports AEX email-engine sendTransactionalEmail: render a
// typed template and enqueue it on the system account. Fail-soft when no system
// account is configured. Not one of the 28 mailbox procedures — it is the
// capability the email context provides; main bridges other contexts' ACL
// out-ports to it.
export interface SendTransactionalEmailCommand<N extends TemplateName = TemplateName> {
  to: string
  template: N
  data: TemplateData[N]
  locale?: EmailLocale
}

export interface SendTransactionalResult {
  sent: boolean
  reason?: 'no-system-account'
}

export interface SendTransactionalEmail {
  execute<N extends TemplateName>(cmd: SendTransactionalEmailCommand<N>): Promise<Result<SendTransactionalResult>>
}

// Driving port for the EmailWorker: deliver one queued email via SMTP and
// optionally persist it to the Sent folder (AEX email-worker.ts).
export interface DeliverQueuedEmail {
  execute(job: QueuedEmail): Promise<Result<{ delivered: boolean }>>
}
