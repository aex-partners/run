import { sql } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { FolderCounts, FolderCountsResult } from '@/contexts/email/application/queries/FolderCounts'
import { accessibleAccountIds } from '@/contexts/email/adapters/out/persistence/accountScope'

const ZERO: FolderCountsResult = { inbox: 0, sent: 0, drafts: 0, spam: 0, trash: 0, starred: 0 }

// Read-side adapter. Ports AEX emails.folderCounts: one aggregate query with
// FILTER counts (inbox counts UNREAD only). Validates a supplied accountId
// against the caller's accessible set.
export class DrizzleFolderCounts implements FolderCounts {
  constructor(private readonly db: Database) {}

  async execute(input: { userId: string; accountId?: string }): Promise<FolderCountsResult> {
    const accountIds = await accessibleAccountIds(this.db, input.userId)
    if (accountIds.length === 0) return { ...ZERO }
    if (input.accountId && !accountIds.includes(input.accountId)) return { ...ZERO }

    const ids = input.accountId ? [input.accountId] : accountIds
    const accountFilter = sql`account_id IN (${sql.join(
      ids.map((id) => sql`${id}`),
      sql`, `,
    )})`

    const rows = await this.db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE folder = 'inbox' AND read = 0) as inbox,
        COUNT(*) FILTER (WHERE folder = 'sent') as sent,
        COUNT(*) FILTER (WHERE folder = 'drafts') as drafts,
        COUNT(*) FILTER (WHERE folder = 'spam') as spam,
        COUNT(*) FILTER (WHERE folder = 'trash') as trash,
        COUNT(*) FILTER (WHERE starred = 1) as starred
      FROM emails
      WHERE ${accountFilter}
    `)

    const result = (rows as unknown as Array<Record<string, unknown>>)[0]
    if (!result) return { ...ZERO }
    return {
      inbox: Number(result.inbox) || 0,
      sent: Number(result.sent) || 0,
      drafts: Number(result.drafts) || 0,
      spam: Number(result.spam) || 0,
      trash: Number(result.trash) || 0,
      starred: Number(result.starred) || 0,
    }
  }
}
