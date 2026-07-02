import { eq } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { emailAccounts, mailAccountMembers } from '@/platform/db/schema'

// Shared read-side helper: the ids of every account a user can act on (owned +
// shared memberships). The read adapters scope their queries through this,
// mirroring AEX's getAccessibleAccountsForUser used pervasively in the router.
export async function accessibleAccountIds(db: Database, userId: string): Promise<string[]> {
  const owned = await db.select({ id: emailAccounts.id }).from(emailAccounts).where(eq(emailAccounts.ownerId, userId))
  const memberships = await db
    .select({ accountId: mailAccountMembers.accountId })
    .from(mailAccountMembers)
    .where(eq(mailAccountMembers.userId, userId))

  const ids = new Set(owned.map((r) => r.id))
  for (const m of memberships) ids.add(m.accountId)
  return [...ids]
}
