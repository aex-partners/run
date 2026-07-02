import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { userViewPreferences } from '@/platform/db/schema'
import { ViewPreferenceRepository } from '@/contexts/data/application/ports/out/ViewPreferenceRepository'
import { UserViewPreference } from '@/contexts/data/domain/UserViewPreference'
import { ViewPreferenceId } from '@/contexts/data/domain/ViewPreferenceId'
import { JsonObject } from '@/shared/domain/Json'

type PrefRow = typeof userViewPreferences.$inferSelect

const toDomain = (row: PrefRow): UserViewPreference => {
  let config: JsonObject = {}
  try {
    config = JSON.parse(row.config) as JsonObject
  } catch {
    config = {}
  }
  return UserViewPreference.rehydrate(
    ViewPreferenceId.of(row.id),
    row.userId,
    row.entityId,
    row.activeView,
    config,
  )
}

// Driven adapter over `user_view_preferences`. Upsert on (user, entity).
export class DrizzleViewPreferenceRepository implements ViewPreferenceRepository {
  constructor(private readonly db: Database) {}

  nextId(): ViewPreferenceId {
    return ViewPreferenceId.of(randomUUID())
  }

  async findByUserEntity(userId: string, entityId: string): Promise<UserViewPreference | null> {
    const [row] = await this.db
      .select()
      .from(userViewPreferences)
      .where(and(eq(userViewPreferences.userId, userId), eq(userViewPreferences.entityId, entityId)))
      .limit(1)
    return row ? toDomain(row) : null
  }

  async save(pref: UserViewPreference): Promise<void> {
    const values = {
      id: pref.id.value,
      userId: pref.userId,
      entityId: pref.entityId,
      activeView: pref.activeView,
      config: JSON.stringify(pref.config),
    }
    await this.db
      .insert(userViewPreferences)
      .values(values)
      .onConflictDoUpdate({
        target: [userViewPreferences.userId, userViewPreferences.entityId],
        set: { activeView: values.activeView, config: values.config, updatedAt: new Date() },
      })
  }
}
