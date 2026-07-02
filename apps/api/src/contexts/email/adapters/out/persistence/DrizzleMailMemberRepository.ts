import { and, eq } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { mailAccountMembers } from '@/platform/db/schema'
import { MailMemberRepository } from '@/contexts/email/application/ports/out/MailMemberRepository'
import { MailAccountMember } from '@/contexts/email/domain/MailAccountMember'
import { MailMemberMapper, MailMemberRow } from '@/contexts/email/application/mappers/MailMemberMapper'

// Driven adapter over the Postgres `mail_account_members` table (composite key).
export class DrizzleMailMemberRepository implements MailMemberRepository {
  constructor(private readonly db: Database) {}

  async find(accountId: string, userId: string): Promise<MailAccountMember | null> {
    const [row] = await this.db
      .select()
      .from(mailAccountMembers)
      .where(and(eq(mailAccountMembers.accountId, accountId), eq(mailAccountMembers.userId, userId)))
      .limit(1)
    return row ? MailMemberMapper.toDomain(row as MailMemberRow) : null
  }

  // Upsert on the composite key, mirroring AEX's onConflictDoUpdate(canSend).
  async save(member: MailAccountMember): Promise<void> {
    const values = MailMemberMapper.toValues(member)
    await this.db
      .insert(mailAccountMembers)
      .values(values)
      .onConflictDoUpdate({
        target: [mailAccountMembers.accountId, mailAccountMembers.userId],
        set: { canSend: values.canSend },
      })
  }

  async delete(member: MailAccountMember): Promise<void> {
    await this.db
      .delete(mailAccountMembers)
      .where(
        and(eq(mailAccountMembers.accountId, member.accountId), eq(mailAccountMembers.userId, member.userId)),
      )
  }
}
