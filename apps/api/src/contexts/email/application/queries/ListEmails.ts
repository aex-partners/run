import { EmailFolder } from '@/contexts/email/domain/EmailFolder'
import { Label } from '@/contexts/email/domain/Label'

// Read side (CQRS). Backs emails.list: owner-scoped, folder-filtered, searchable,
// paginated, shaped into the mailbox list view model (relative timestamp).
export interface ListEmailsOptions {
  userId: string
  accountId?: string
  folder: EmailFolder
  search?: string
  limit: number
  offset: number
}

export interface EmailListItem {
  id: string
  accountId: string
  from: string
  fromEmail: string
  subject: string
  preview: string
  timestamp: string
  read: boolean
  starred: boolean
  hasAttachment: boolean
  labels: Label[]
  folder: EmailFolder
  aiSummary: string | null
  aiDraft: string | null
}

export interface ListEmails {
  execute(opts: ListEmailsOptions): Promise<EmailListItem[]>
}
