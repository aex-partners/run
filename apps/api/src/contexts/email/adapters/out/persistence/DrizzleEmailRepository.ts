import { randomUUID } from 'node:crypto'
import { and, eq, inArray } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { emails } from '@/platform/db/schema'
import { EmailRepository } from '@/contexts/email/application/ports/out/EmailRepository'
import { Email } from '@/contexts/email/domain/Email'
import { EmailId } from '@/contexts/email/domain/ids'
import { EmailMapper, EmailRow } from '@/contexts/email/application/mappers/EmailMapper'

// Driven adapter over the Postgres `emails` table. Account-scoped reads carry the
// caller's accessible account ids so ownership can never be bypassed.
export class DrizzleEmailRepository implements EmailRepository {
  constructor(private readonly db: Database) {}

  nextId(): EmailId {
    return EmailId.of(randomUUID())
  }

  async findById(id: EmailId): Promise<Email | null> {
    const [row] = await this.db.select().from(emails).where(eq(emails.id, id.value)).limit(1)
    return row ? EmailMapper.toDomain(row as EmailRow) : null
  }

  async findInAccounts(id: EmailId, accountIds: readonly string[]): Promise<Email | null> {
    if (accountIds.length === 0) return null
    const [row] = await this.db
      .select()
      .from(emails)
      .where(and(eq(emails.id, id.value), inArray(emails.accountId, [...accountIds])))
      .limit(1)
    return row ? EmailMapper.toDomain(row as EmailRow) : null
  }

  async findManyInAccounts(ids: readonly string[], accountIds: readonly string[]): Promise<Email[]> {
    if (ids.length === 0 || accountIds.length === 0) return []
    const rows = await this.db
      .select()
      .from(emails)
      .where(and(inArray(emails.id, [...ids]), inArray(emails.accountId, [...accountIds])))
    return rows.map((row) => EmailMapper.toDomain(row as EmailRow))
  }

  async existingExternalIds(accountId: string): Promise<Set<string>> {
    const rows = await this.db
      .select({ externalId: emails.externalId })
      .from(emails)
      .where(eq(emails.accountId, accountId))
    return new Set(rows.map((r) => r.externalId))
  }

  async save(email: Email): Promise<void> {
    const values = EmailMapper.toValues(email)
    const { id, ...mutable } = values
    await this.db.insert(emails).values(values).onConflictDoUpdate({ target: emails.id, set: mutable })
  }

  async saveMany(toSave: readonly Email[]): Promise<void> {
    if (toSave.length === 0) return
    const values = toSave.map((e) => EmailMapper.toValues(e))
    await this.db.insert(emails).values(values).onConflictDoNothing({ target: emails.id })
  }
}
