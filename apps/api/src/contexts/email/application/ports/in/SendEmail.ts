import { Result } from '@/shared/kernel/Result'

// Driving port behind emails.send. Sends synchronously via SMTP (matching AEX's
// inline send), stores the message in the Sent folder, and returns its id.
export interface SendEmailAttachment {
  id: string
  name: string
  path: string
  mimeType?: string
}

export interface SendEmailCommand {
  actorId: string
  accountId: string
  to: string
  cc?: string
  subject: string
  body: string
  attachments?: SendEmailAttachment[]
  inReplyTo?: string
  threadId?: string
}

export interface SendEmail {
  execute(cmd: SendEmailCommand): Promise<Result<{ success: true; id: string }>>
}
