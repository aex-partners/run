import { Email } from '@/contexts/email/domain/Email'
import { EmailId } from '@/contexts/email/domain/ids'
import { EmailFolder, isEmailFolder } from '@/contexts/email/domain/EmailFolder'
import { parseLabels } from '@/contexts/email/domain/Label'

// Mirrors the AEX `emails` table. Booleans live as 0/1 integers and address
// lists / labels live as JSON strings on disk; the mapper is the only place that
// knows that. The on-disk shape never leaks past this boundary.
export interface EmailRow {
  id: string
  accountId: string
  externalId: string
  threadId: string | null
  fromName: string
  fromEmail: string
  to: string
  cc: string
  subject: string
  preview: string
  bodyHtml: string | null
  bodyText: string | null
  folder: string
  read: number
  starred: number
  hasAttachment: number
  labels: string
  aiSummary: string | null
  aiDraft: string | null
  date: Date
  createdAt: Date
}

// Column set written on insert (id included; createdAt is DB-defaulted).
export interface EmailValues {
  id: string
  accountId: string
  externalId: string
  threadId: string | null
  fromName: string
  fromEmail: string
  to: string
  cc: string
  subject: string
  preview: string
  bodyHtml: string | null
  bodyText: string | null
  folder: EmailFolder
  read: number
  starred: number
  hasAttachment: number
  labels: string
  aiSummary: string | null
  aiDraft: string | null
  date: Date
}

const parseStringList = (raw: string): string[] => {
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

export const EmailMapper = {
  toValues(email: Email): EmailValues {
    return {
      id: email.id.value,
      accountId: email.accountId,
      externalId: email.externalId,
      threadId: email.threadId,
      fromName: email.fromName,
      fromEmail: email.fromEmail,
      to: JSON.stringify(email.to),
      cc: JSON.stringify(email.cc),
      subject: email.subject,
      preview: email.preview,
      bodyHtml: email.bodyHtml,
      bodyText: email.bodyText,
      folder: email.folder,
      read: email.read ? 1 : 0,
      starred: email.starred ? 1 : 0,
      hasAttachment: email.hasAttachment ? 1 : 0,
      labels: JSON.stringify(email.labels),
      aiSummary: email.aiSummary,
      aiDraft: email.aiDraft,
      date: email.date,
    }
  },

  toDomain(row: EmailRow): Email {
    const folder: EmailFolder = isEmailFolder(row.folder) ? row.folder : 'inbox'
    return Email.rehydrate(EmailId.of(row.id), {
      accountId: row.accountId,
      externalId: row.externalId,
      threadId: row.threadId,
      fromName: row.fromName,
      fromEmail: row.fromEmail,
      to: parseStringList(row.to),
      cc: parseStringList(row.cc),
      subject: row.subject,
      preview: row.preview,
      bodyHtml: row.bodyHtml,
      bodyText: row.bodyText,
      folder,
      read: row.read === 1,
      starred: row.starred === 1,
      hasAttachment: row.hasAttachment === 1,
      labels: parseLabels(row.labels),
      aiSummary: row.aiSummary,
      aiDraft: row.aiDraft,
      date: row.date,
      createdAt: row.createdAt,
    })
  },
}
