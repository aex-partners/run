import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { emailAccounts, mailAccountMembers } from '@/platform/db/schema'
import { EmailAccountRepository } from '@/contexts/email/application/ports/out/EmailAccountRepository'
import { EmailAccount } from '@/contexts/email/domain/EmailAccount'
import { EmailAccountId } from '@/contexts/email/domain/ids'
import { EmailAccountMapper, EmailAccountRow } from '@/contexts/email/application/mappers/EmailAccountMapper'

// Driven adapter over the Postgres `email_accounts` table.
export class DrizzleEmailAccountRepository implements EmailAccountRepository {
  constructor(private readonly db: Database) {}

  nextId(): EmailAccountId {
    return EmailAccountId.of(randomUUID())
  }

  async findById(id: EmailAccountId): Promise<EmailAccount | null> {
    const [row] = await this.db.select().from(emailAccounts).where(eq(emailAccounts.id, id.value)).limit(1)
    return row ? EmailAccountMapper.toDomain(row as EmailAccountRow) : null
  }

  // Ports AEX getAccessibleAccountsForUser: owned accounts plus shared accounts
  // the user is a member of, de-duplicated.
  async accountIdsForUser(userId: string): Promise<string[]> {
    const owned = await this.db
      .select({ id: emailAccounts.id })
      .from(emailAccounts)
      .where(eq(emailAccounts.ownerId, userId))

    const memberships = await this.db
      .select({ accountId: mailAccountMembers.accountId })
      .from(mailAccountMembers)
      .where(eq(mailAccountMembers.userId, userId))

    const ids = new Set(owned.map((r) => r.id))
    for (const m of memberships) ids.add(m.accountId)
    return [...ids]
  }

  async save(account: EmailAccount): Promise<void> {
    const values = EmailAccountMapper.toValues(account)
    const { id, ...mutable } = values
    await this.db.insert(emailAccounts).values(values).onConflictDoUpdate({ target: emailAccounts.id, set: mutable })
  }

  async delete(account: EmailAccount): Promise<void> {
    await this.db.delete(emailAccounts).where(eq(emailAccounts.id, account.id.value))
  }
}
