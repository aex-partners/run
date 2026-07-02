import { and, ne, sql } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { users } from '@/platform/db/schema'
import { ListAssignableUsers, AssignableUser } from '@/contexts/identity/application/queries/ListAssignableUsers'

// Read-side adapter (CQRS). Non-banned, non-bot users for the task-assignment
// picker. `is not true` matches the source: it keeps rows where banned is false
// OR null. Mirrors users.listAssignable.
export class DrizzleListAssignableUsers implements ListAssignableUsers {
  constructor(private readonly db: Database) {}

  async execute(): Promise<AssignableUser[]> {
    const rows = await this.db
      .select({ id: users.id, name: users.name, email: users.email, image: users.image })
      .from(users)
      .where(and(sql`${users.banned} is not true`, ne(users.kind, 'bot')))

    return rows.map((u): AssignableUser => ({
      id: u.id,
      name: u.name,
      email: u.email,
      image: u.image,
    }))
  }
}
