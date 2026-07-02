import { and, eq, inArray } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { emails, emailAttachments } from '@/platform/db/schema'
import { GetEmail, EmailDetail } from '@/contexts/email/application/queries/GetEmail'
import { parseLabels } from '@/contexts/email/domain/Label'
import { accessibleAccountIds } from '@/contexts/email/adapters/out/persistence/accountScope'

const parseStringList = (raw: string): string[] => {
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

// Read-side adapter. Ports AEX emails.getById: ownership-checked single email
// with attachments. Opening an unread email marks it read as a side effect
// (a deliberate read-model write carried over from AEX), so `read` is true.
export class DrizzleGetEmail implements GetEmail {
  constructor(private readonly db: Database) {}

  async execute(input: { userId: string; id: string }): Promise<EmailDetail | null> {
    const accountIds = await accessibleAccountIds(this.db, input.userId)
    if (accountIds.length === 0) return null

    const [email] = await this.db
      .select()
      .from(emails)
      .where(and(eq(emails.id, input.id), inArray(emails.accountId, accountIds)))
      .limit(1)
    if (!email) return null

    const attachments = await this.db
      .select()
      .from(emailAttachments)
      .where(eq(emailAttachments.emailId, input.id))

    if (email.read === 0) {
      await this.db.update(emails).set({ read: 1 }).where(eq(emails.id, input.id))
    }

    return {
      id: email.id,
      accountId: email.accountId,
      externalId: email.externalId,
      threadId: email.threadId,
      from: email.fromName,
      fromEmail: email.fromEmail,
      to: parseStringList(email.to),
      cc: parseStringList(email.cc),
      subject: email.subject,
      bodyHtml: email.bodyHtml,
      bodyText: email.bodyText,
      folder: email.folder,
      read: true,
      starred: email.starred === 1,
      hasAttachment: email.hasAttachment === 1,
      labels: parseLabels(email.labels),
      aiSummary: email.aiSummary,
      aiDraft: email.aiDraft,
      date: email.date,
      attachments: attachments.map((a) => ({
        id: a.id,
        name: a.name,
        mimeType: a.mimeType,
        size: a.size,
        fileId: a.fileId,
        externalId: a.externalId,
      })),
    }
  }
}
