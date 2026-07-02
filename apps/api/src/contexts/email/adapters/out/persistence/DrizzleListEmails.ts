import { and, desc, eq, ilike, inArray, or, SQL } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { emails } from '@/platform/db/schema'
import { ListEmails, ListEmailsOptions, EmailListItem } from '@/contexts/email/application/queries/ListEmails'
import { parseLabels } from '@/contexts/email/domain/Label'
import { accessibleAccountIds } from '@/contexts/email/adapters/out/persistence/accountScope'

// Read-side adapter. Ports AEX emails.list 1:1: account-scoped, folder-filtered
// (starred is a flag view), searchable, paginated, shaped into the list view
// model with a relative timestamp.
export class DrizzleListEmails implements ListEmails {
  constructor(private readonly db: Database) {}

  async execute(opts: ListEmailsOptions): Promise<EmailListItem[]> {
    const accountIds = await accessibleAccountIds(this.db, opts.userId)
    if (accountIds.length === 0) return []

    const conditions: SQL[] = []

    if (opts.accountId) {
      if (!accountIds.includes(opts.accountId)) return []
      conditions.push(eq(emails.accountId, opts.accountId))
    } else {
      conditions.push(inArray(emails.accountId, accountIds))
    }

    if (opts.folder === 'starred') {
      conditions.push(eq(emails.starred, 1))
    } else {
      conditions.push(eq(emails.folder, opts.folder))
    }

    if (opts.search) {
      const term = `%${opts.search}%`
      const match = or(ilike(emails.subject, term), ilike(emails.fromName, term), ilike(emails.preview, term))
      if (match) conditions.push(match)
    }

    const where = conditions.length === 1 ? conditions[0] : and(...conditions)

    const rows = await this.db
      .select()
      .from(emails)
      .where(where)
      .orderBy(desc(emails.date))
      .limit(opts.limit)
      .offset(opts.offset)

    return rows.map(
      (row): EmailListItem => ({
        id: row.id,
        accountId: row.accountId,
        from: row.fromName,
        fromEmail: row.fromEmail,
        subject: row.subject,
        preview: row.preview,
        timestamp: formatEmailDate(row.date),
        read: row.read === 1,
        starred: row.starred === 1,
        hasAttachment: row.hasAttachment === 1,
        labels: parseLabels(row.labels),
        folder: row.folder,
        aiSummary: row.aiSummary,
        aiDraft: row.aiDraft,
      }),
    )
  }
}

// Ported 1:1 from AEX's formatEmailDate: time today, "Yesterday", weekday this
// week, else "Mon D".
function formatEmailDate(date: Date): string {
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000)
  if (diffDays === 0) return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'short' })
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
