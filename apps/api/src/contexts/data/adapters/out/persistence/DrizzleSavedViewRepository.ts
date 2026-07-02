import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
// savedViews is defined in the schema's `app` module but not re-exported by the
// schema index; import it directly (adapters may depend on @/platform/*).
import { savedViews } from '@/platform/db/schema/app'
import { SavedViewRepository } from '@/contexts/data/application/ports/out/SavedViewRepository'
import { SavedView, ViewType } from '@/contexts/data/domain/SavedView'
import { SavedViewId } from '@/contexts/data/domain/SavedViewId'
import { Json, JsonObject } from '@/shared/domain/Json'

type SavedViewDrizzleRow = typeof savedViews.$inferSelect

const toDomain = (row: SavedViewDrizzleRow): SavedView =>
  SavedView.rehydrate(
    SavedViewId.of(row.id),
    row.entityId,
    row.ownerId,
    row.name,
    row.isPublic === 1,
    row.viewType as ViewType,
    JSON.parse(row.filters) as Json[],
    JSON.parse(row.config) as JsonObject,
  )

// Driven adapter over the Postgres `saved_views` table.
export class DrizzleSavedViewRepository implements SavedViewRepository {
  constructor(private readonly db: Database) {}

  nextId(): SavedViewId {
    return SavedViewId.of(randomUUID())
  }

  async findById(id: SavedViewId): Promise<SavedView | null> {
    const [row] = await this.db.select().from(savedViews).where(eq(savedViews.id, id.value)).limit(1)
    return row ? toDomain(row) : null
  }

  async save(view: SavedView): Promise<void> {
    const values = {
      id: view.id.value,
      entityId: view.entityId,
      ownerId: view.ownerId,
      name: view.name,
      isPublic: view.isPublic ? 1 : 0,
      viewType: view.viewType,
      filters: JSON.stringify(view.filters),
      config: JSON.stringify(view.config),
    }
    await this.db
      .insert(savedViews)
      .values(values)
      .onConflictDoUpdate({
        target: savedViews.id,
        set: {
          name: values.name,
          isPublic: values.isPublic,
          viewType: values.viewType,
          filters: values.filters,
          config: values.config,
          updatedAt: new Date(),
        },
      })
  }

  async delete(id: SavedViewId): Promise<void> {
    await this.db.delete(savedViews).where(eq(savedViews.id, id.value))
  }
}
