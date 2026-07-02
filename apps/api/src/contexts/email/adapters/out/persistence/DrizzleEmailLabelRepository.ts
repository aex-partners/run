import { randomUUID } from 'node:crypto'
import { and, eq, inArray } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { emailLabels } from '@/platform/db/schema'
import { EmailLabelRepository } from '@/contexts/email/application/ports/out/EmailLabelRepository'
import { EmailLabel } from '@/contexts/email/domain/EmailLabel'
import { EmailLabelId } from '@/contexts/email/domain/ids'
import { EmailLabelMapper, EmailLabelRow } from '@/contexts/email/application/mappers/EmailLabelMapper'

// Driven adapter over the Postgres `email_labels` table.
export class DrizzleEmailLabelRepository implements EmailLabelRepository {
  constructor(private readonly db: Database) {}

  nextId(): EmailLabelId {
    return EmailLabelId.of(randomUUID())
  }

  async findById(id: EmailLabelId): Promise<EmailLabel | null> {
    const [row] = await this.db.select().from(emailLabels).where(eq(emailLabels.id, id.value)).limit(1)
    return row ? EmailLabelMapper.toDomain(row as EmailLabelRow) : null
  }

  async findByNameInAccounts(name: string, accountIds: readonly string[]): Promise<EmailLabel | null> {
    if (accountIds.length === 0) return null
    const [row] = await this.db
      .select()
      .from(emailLabels)
      .where(and(eq(emailLabels.name, name), inArray(emailLabels.accountId, [...accountIds])))
      .limit(1)
    return row ? EmailLabelMapper.toDomain(row as EmailLabelRow) : null
  }

  async save(label: EmailLabel): Promise<void> {
    const values = EmailLabelMapper.toValues(label)
    const { id, ...mutable } = values
    await this.db.insert(emailLabels).values(values).onConflictDoUpdate({ target: emailLabels.id, set: mutable })
  }

  async delete(label: EmailLabel): Promise<void> {
    await this.db.delete(emailLabels).where(eq(emailLabels.id, label.id.value))
  }
}
