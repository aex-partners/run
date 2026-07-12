import { eq } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { users } from '@/platform/db/schema'
import { ResolveOwner } from '@/contexts/manufacturing/application/ports/out/ResolveOwner'

// Resolves the workspace owner (manufacturing's record writes are owned by them). Reads
// the platform users table (shared schema), like scripts/seed-buenaca.ts.
export class DrizzleResolveOwner implements ResolveOwner {
  constructor(private readonly db: Database) {}
  async ownerId(): Promise<string | null> {
    const [owner] = await this.db.select({ id: users.id }).from(users).where(eq(users.role, 'owner')).limit(1)
    return owner?.id ?? null
  }
}
