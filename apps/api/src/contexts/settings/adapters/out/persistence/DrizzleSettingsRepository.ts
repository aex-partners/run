import { eq } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { settings } from '@/platform/db/schema'
import { SettingsRepository } from '@/contexts/settings/application/ports/out/SettingsRepository'

// Driven adapter. Backs the key/value store with the `settings` table; upsert
// uses Postgres ON CONFLICT on the key PK, refreshing value + updatedAt.
export class DrizzleSettingsRepository implements SettingsRepository {
  constructor(private readonly db: Database) {}

  async find(key: string): Promise<string | null> {
    const [row] = await this.db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, key))
      .limit(1)
    return row?.value ?? null
  }

  async upsert(key: string, value: string, updatedAt: Date): Promise<void> {
    await this.db
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt } })
  }
}
