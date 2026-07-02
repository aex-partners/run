import { and, eq } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { userViewPreferences } from '@/platform/db/schema'
import {
  GetViewPreference,
  GetViewPreferenceOptions,
  ViewPreferenceView,
} from '@/contexts/data/application/queries/GetViewPreference'
import { JsonObject } from '@/shared/domain/Json'

// Read-side adapter. Ports view-preferences.get.
export class DrizzleGetViewPreference implements GetViewPreference {
  constructor(private readonly db: Database) {}

  async execute(opts: GetViewPreferenceOptions): Promise<ViewPreferenceView | null> {
    const [row] = await this.db
      .select()
      .from(userViewPreferences)
      .where(
        and(
          eq(userViewPreferences.userId, opts.userId),
          eq(userViewPreferences.entityId, opts.entityId),
        ),
      )
      .limit(1)
    if (!row) return null

    let config: JsonObject = {}
    try {
      config = JSON.parse(row.config) as JsonObject
    } catch {
      config = {}
    }
    return { activeView: row.activeView, config }
  }
}
