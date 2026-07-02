import { eq } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { loginAttempts } from '@/platform/db/schema'
import { LoginAttemptStore } from '@/contexts/identity/application/ports/out/LoginAttemptStore'
import { LoginAttemptMapper, LoginAttemptRow } from '@/contexts/identity/application/mappers/LoginAttemptMapper'
import { LoginAttempt } from '@/contexts/identity/domain/LoginAttempt'
import { Email } from '@/contexts/identity/domain/Email'

// Driven adapter over the `login_attempts` table (timestamptz columns). The
// source did the sliding-window UPSERT atomically in SQL; here the pure decision
// is in the aggregate and this adapter does load -> save (upsert) and delete.
export class DrizzleLoginAttemptStore implements LoginAttemptStore {
  constructor(private readonly db: Database) {}

  async find(email: Email): Promise<LoginAttempt | null> {
    const [row] = await this.db
      .select()
      .from(loginAttempts)
      .where(eq(loginAttempts.email, email.value))
      .limit(1)
    return row ? LoginAttemptMapper.toDomain(row as LoginAttemptRow) : null
  }

  async save(attempt: LoginAttempt): Promise<void> {
    const row = LoginAttemptMapper.toPersistence(attempt)
    await this.db
      .insert(loginAttempts)
      .values(row)
      .onConflictDoUpdate({
        target: loginAttempts.email,
        set: {
          attempts: row.attempts,
          lastAttemptAt: row.lastAttemptAt,
          lockedUntil: row.lockedUntil,
        },
      })
  }

  async delete(email: Email): Promise<void> {
    await this.db.delete(loginAttempts).where(eq(loginAttempts.email, email.value))
  }
}
