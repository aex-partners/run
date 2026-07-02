import { inArray } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { users } from '@/platform/db/schema'
import { GetUsers, UserRef } from '@/contexts/identity/application/ports/in/GetUsers'

// Read-side adapter (CQRS) over the OWN `users` table. Batch-resolves the
// public identity reference other contexts consume via their ACL bridge.
export class DrizzleGetUsers implements GetUsers {
  constructor(private readonly db: Database) {}

  async execute(ids: string[]): Promise<UserRef[]> {
    if (ids.length === 0) return []

    const rows = await this.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
        role: users.role,
      })
      .from(users)
      .where(inArray(users.id, ids))

    return rows.map((u): UserRef => ({
      id: u.id,
      name: u.name,
      email: u.email,
      image: u.image,
      role: u.role,
    }))
  }
}
