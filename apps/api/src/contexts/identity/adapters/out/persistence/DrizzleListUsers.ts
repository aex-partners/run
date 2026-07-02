import { Database } from '@/platform/db/client'
import { users } from '@/platform/db/schema'
import { ListUsers, UserListItem } from '@/contexts/identity/application/queries/ListUsers'

// Read-side adapter (CQRS). Reads the admin user list and derives the
// active/inactive status. Mirrors users.list.
export class DrizzleListUsers implements ListUsers {
  constructor(private readonly db: Database) {}

  async execute(): Promise<UserListItem[]> {
    const rows = await this.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        banned: users.banned,
        createdAt: users.createdAt,
        kind: users.kind,
      })
      .from(users)

    return rows.map((u): UserListItem => {
      const banned = u.banned ?? false
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        banned,
        createdAt: u.createdAt,
        status: banned ? 'inactive' : 'active',
        kind: u.kind,
      }
    })
  }
}
