import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { users } from '@/platform/db/schema'
import { UserRepository } from '@/contexts/identity/application/ports/out/UserRepository'
import { UserMapper, UserRow } from '@/contexts/identity/application/mappers/UserMapper'
import { User } from '@/contexts/identity/domain/User'
import { UserId } from '@/contexts/identity/domain/UserId'
import { Email } from '@/contexts/identity/domain/Email'

// Driven adapter over the `users` table. The port and mapper stay identical to
// any other backing store; only the query mechanics live here.
export class DrizzleUserRepository implements UserRepository {
  constructor(private readonly db: Database) {}

  nextId(): UserId {
    return UserId.of(randomUUID())
  }

  async findById(id: UserId): Promise<User | null> {
    const [row] = await this.db.select().from(users).where(eq(users.id, id.value)).limit(1)
    return row ? UserMapper.toDomain(row as UserRow) : null
  }

  async findByEmail(email: Email): Promise<User | null> {
    const [row] = await this.db.select().from(users).where(eq(users.email, email.value)).limit(1)
    return row ? UserMapper.toDomain(row as UserRow) : null
  }

  async existsByEmail(email: Email): Promise<boolean> {
    const [row] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.value))
      .limit(1)
    return !!row
  }

  async save(user: User): Promise<void> {
    const row = UserMapper.toPersistence(user)
    await this.db
      .insert(users)
      .values(row)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          name: row.name,
          email: row.email,
          emailVerified: row.emailVerified,
          image: row.image,
          role: row.role,
          kind: row.kind,
          banned: row.banned,
          banReason: row.banReason,
          banExpires: row.banExpires,
          twoFactorEnabled: row.twoFactorEnabled,
          updatedAt: row.updatedAt,
        },
      })
  }

  async delete(id: UserId): Promise<void> {
    await this.db.delete(users).where(eq(users.id, id.value))
  }
}
