import nodemailer, { Transporter } from 'nodemailer'
import { SmtpSettings } from '@/contexts/email/domain/EmailAccount'
import { SmtpSender, OutgoingEmail, SmtpSendResult } from '@/contexts/email/application/ports/out/SmtpSender'

// Driven adapter for the SmtpSender port. Ports AEX email/provider transport:
// builds a nodemailer transporter per send (same timeouts) and a "Name <addr>"
// from header. Attachment bytes arrive resolved (Uint8Array) so no disk access
// happens here.
export class NodemailerSender implements SmtpSender {
  private transport(settings: SmtpSettings): Transporter {
    return nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      auth: { user: settings.user, pass: settings.pass },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 30_000,
    })
  }

  async send(settings: SmtpSettings, message: OutgoingEmail): Promise<SmtpSendResult> {
    const transporter = this.transport(settings)
    const displayName = message.fromName || settings.fromName
    const from = displayName ? `${displayName} <${settings.from}>` : settings.from

    const info = await transporter.sendMail({
      from,
      to: message.to.join(', '),
      cc: message.cc?.join(', '),
      subject: message.subject,
      html: message.bodyHtml,
      text: message.bodyText,
      replyTo: message.replyTo,
      inReplyTo: message.inReplyTo,
      attachments: message.attachments?.map((a) => ({
        filename: a.filename,
        content: Buffer.from(a.content),
        contentType: a.contentType,
      })),
    })

    return {
      messageId: info.messageId,
      accepted: (info.accepted ?? []).map(String),
      rejected: (info.rejected ?? []).map(String),
    }
  }

  async verify(settings: SmtpSettings): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.transport(settings).verify()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Connection failed' }
    }
  }
}
