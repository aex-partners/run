import { and, eq, inArray } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { emails } from '@/platform/db/schema'
import { GetThread, ThreadMessage } from '@/contexts/email/application/queries/GetThread'
import { accessibleAccountIds } from '@/contexts/email/adapters/out/persistence/accountScope'

const parseStringList = (raw: string): string[] => {
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

// Read-side adapter. Ports AEX emails.getThread: accessible emails sharing a
// threadId, oldest first.
export class DrizzleGetThread implements GetThread {
  constructor(private readonly db: Database) {}

  async execute(input: { userId: string; threadId: string }): Promise<ThreadMessage[]> {
    const accountIds = await accessibleAccountIds(this.db, input.userId)
    if (accountIds.length === 0) return []

    const rows = await this.db
      .select()
      .from(emails)
      .where(and(eq(emails.threadId, input.threadId), inArray(emails.accountId, accountIds)))
      .orderBy(emails.date)

    return rows.map(
      (row): ThreadMessage => ({
        id: row.id,
        from: row.fromName,
        fromEmail: row.fromEmail,
        subject: row.subject,
        bodyHtml: row.bodyHtml,
        bodyText: row.bodyText,
        date: row.date,
        to: parseStringList(row.to),
        cc: parseStringList(row.cc),
      }),
    )
  }
}
