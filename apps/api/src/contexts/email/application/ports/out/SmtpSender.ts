import { SmtpSettings } from '@/contexts/email/domain/EmailAccount'

// An attachment resolved to bytes by the AttachmentStore ACL. Bytes are a
// Uint8Array so the port stays free of node Buffer types.
export interface OutgoingAttachment {
  filename: string
  content: Uint8Array
  contentType?: string
}

export interface OutgoingEmail {
  to: string[]
  cc?: string[]
  subject: string
  bodyHtml: string
  bodyText?: string
  fromName?: string
  replyTo?: string
  inReplyTo?: string
  attachments?: OutgoingAttachment[]
}

export interface SmtpSendResult {
  messageId: string
  accepted: string[]
  rejected: string[]
}

// Driven port for outbound SMTP. The Nodemailer adapter ports AEX email/provider
// transport. `settings.pass` is already decrypted by the use case.
export interface SmtpSender {
  send(settings: SmtpSettings, message: OutgoingEmail): Promise<SmtpSendResult>
  verify(settings: SmtpSettings): Promise<{ ok: boolean; error?: string }>
}
