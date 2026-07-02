import { eq, inArray } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { emailAccounts, mailAccountMembers } from '@/platform/db/schema'
import { ListAccounts, AccountListItem } from '@/contexts/email/application/queries/ListAccounts'

// Read-side adapter. Ports AEX getAccessibleAccountsForUser + mailAccounts.list:
// owned accounts first, then the shared accounts the user is a member of, shaped
// for the account picker.
export class DrizzleListAccounts implements ListAccounts {
  constructor(private readonly db: Database) {}

  async execute(input: { userId: string }): Promise<AccountListItem[]> {
    const owned = await this.db.select().from(emailAccounts).where(eq(emailAccounts.ownerId, input.userId))
    const ownedIds = new Set(owned.map((a) => a.id))

    const memberships = await this.db
      .select({ accountId: mailAccountMembers.accountId })
      .from(mailAccountMembers)
      .where(eq(mailAccountMembers.userId, input.userId))
    const sharedIds = memberships.map((m) => m.accountId).filter((id) => !ownedIds.has(id))

    const shared =
      sharedIds.length > 0
        ? await this.db.select().from(emailAccounts).where(inArray(emailAccounts.id, sharedIds))
        : []

    return [...owned, ...shared].map((a) => ({
      id: a.id,
      displayName: a.displayName,
      emailAddress: a.emailAddress,
      fromName: a.fromName,
      isShared: a.isShared === 1,
      isOwner: a.ownerId === input.userId,
    }))
  }
}
