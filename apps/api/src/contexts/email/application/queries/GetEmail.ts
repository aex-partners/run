import { EmailFolder } from '@/contexts/email/domain/EmailFolder'
import { Label } from '@/contexts/email/domain/Label'

// Read side (CQRS). Backs emails.getById: a single email with its attachments,
// ownership-checked. Returns null when not accessible.
//
// AEX's getById marks the email read as a side effect of opening it; the read
// adapter preserves that behaviour (a read-model write), so the returned `read`
// is always true. Documented as a deliberate carry-over from the source.
export interface EmailAttachmentView {
  id: string
  name: string
  mimeType: string
  size: number
  fileId: string | null
  externalId: string | null
}

export interface EmailDetail {
  id: string
  accountId: string
  externalId: string
  threadId: string | null
  from: string
  fromEmail: string
  to: string[]
  cc: string[]
  subject: string
  bodyHtml: string | null
  bodyText: string | null
  folder: EmailFolder
  read: boolean
  starred: boolean
  hasAttachment: boolean
  labels: Label[]
  aiSummary: string | null
  aiDraft: string | null
  date: Date
  attachments: EmailAttachmentView[]
}

export interface GetEmail {
  execute(input: { userId: string; id: string }): Promise<EmailDetail | null>
}
