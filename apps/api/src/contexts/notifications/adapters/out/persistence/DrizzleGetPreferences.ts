import { eq } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { notificationPreferences } from '@/platform/db/schema'
import {
  GetPreferences,
  GetPreferencesQuery,
  PreferencesView,
} from '@/contexts/notifications/application/queries/GetPreferences'

// Read-side adapter (CQRS). An absent row reads as enabled (matches the digest
// worker and the domain default).
export class DrizzleGetPreferences implements GetPreferences {
  constructor(private readonly db: Database) {}

  async execute(q: GetPreferencesQuery): Promise<PreferencesView> {
    const rows = await this.db
      .select({ emailDigest: notificationPreferences.emailDigest })
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, q.userId))
      .limit(1)
    return { emailDigest: rows[0]?.emailDigest ?? true }
  }
}
