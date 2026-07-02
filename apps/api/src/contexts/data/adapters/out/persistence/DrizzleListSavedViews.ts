import { and, asc, eq, or } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { savedViews } from '@/platform/db/schema/app'
import {
  ListSavedViews,
  ListSavedViewsOptions,
  SavedViewView,
} from '@/contexts/data/application/queries/ListSavedViews'
import { Json, JsonObject } from '@/shared/domain/Json'

// Read-side adapter. The views visible to a user for an entity: their own plus
// any public ones.
export class DrizzleListSavedViews implements ListSavedViews {
  constructor(private readonly db: Database) {}

  async execute(opts: ListSavedViewsOptions): Promise<SavedViewView[]> {
    const rows = await this.db
      .select()
      .from(savedViews)
      .where(
        and(
          eq(savedViews.entityId, opts.entityId),
          or(eq(savedViews.ownerId, opts.userId), eq(savedViews.isPublic, 1)),
        ),
      )
      .orderBy(asc(savedViews.createdAt))

    return rows.map((row): SavedViewView => ({
      id: row.id,
      entityId: row.entityId,
      ownerId: row.ownerId,
      name: row.name,
      isPublic: row.isPublic === 1,
      viewType: row.viewType,
      filters: JSON.parse(row.filters) as Json[],
      config: JSON.parse(row.config) as JsonObject,
      isOwner: row.ownerId === opts.userId,
    }))
  }
}
