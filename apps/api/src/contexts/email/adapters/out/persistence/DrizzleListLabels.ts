import { eq } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { emailLabels } from '@/platform/db/schema'
import { ListLabels, LabelListItem } from '@/contexts/email/application/queries/ListLabels'
import { accessibleAccountIds } from '@/contexts/email/adapters/out/persistence/accountScope'

// Read-side adapter. Ports AEX emails.labels.list: the label definitions for an
// account the caller can access (empty when it is not theirs).
export class DrizzleListLabels implements ListLabels {
  constructor(private readonly db: Database) {}

  async execute(input: { userId: string; accountId: string }): Promise<LabelListItem[]> {
    const accountIds = await accessibleAccountIds(this.db, input.userId)
    if (!accountIds.includes(input.accountId)) return []

    const rows = await this.db.select().from(emailLabels).where(eq(emailLabels.accountId, input.accountId))
    return rows.map(
      (row): LabelListItem => ({
        id: row.id,
        accountId: row.accountId,
        name: row.name,
        color: row.color,
        createdAt: row.createdAt,
      }),
    )
  }
}
