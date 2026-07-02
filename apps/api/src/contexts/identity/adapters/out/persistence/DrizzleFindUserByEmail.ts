import { eq } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { users } from '@/platform/db/schema'
import { FindUserByEmail } from '@/contexts/identity/application/ports/in/FindUserByEmail'

// Read-side adapter (CQRS) over the OWN `users` table. Resolves a single user id
// by email for the files-context share ACL, bridged in main to files.UserDirectory.
export class DrizzleFindUserByEmail implements FindUserByEmail {
  constructor(private readonly db: Database) {}

  async execute(email: string): Promise<string | null> {
    const [row] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1)

    return row?.id ?? null
  }
}
