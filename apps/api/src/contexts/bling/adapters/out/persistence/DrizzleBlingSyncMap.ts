import { and, eq } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { blingSyncMap } from '@/platform/db/schema'
import { BlingSyncMapPort } from '@/contexts/bling/application/ports/out/BlingSyncMapPort'
import { Clock } from '@/shared/kernel/Clock'

// Persistence adapter for BlingSyncMapPort over the bling_sync_map table.
// Tracks (entitySlug, externalId) -> AEX recordId plus version/contentHash so
// repeated syncs can detect unchanged records and skip redundant writes.
export class DrizzleBlingSyncMap implements BlingSyncMapPort {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
  ) {}

  async listAll(): Promise<{ entitySlug: string; externalId: string; recordId: string }[]> {
    return this.db
      .select({
        entitySlug: blingSyncMap.entitySlug,
        externalId: blingSyncMap.externalId,
        recordId: blingSyncMap.recordId,
      })
      .from(blingSyncMap)
  }

  async get(
    slug: string,
    externalId: string,
  ): Promise<{ recordId: string; version: number; contentHash: string } | null> {
    const rows = await this.db
      .select({
        recordId: blingSyncMap.recordId,
        version: blingSyncMap.version,
        contentHash: blingSyncMap.contentHash,
      })
      .from(blingSyncMap)
      .where(and(eq(blingSyncMap.entitySlug, slug), eq(blingSyncMap.externalId, externalId)))
      .limit(1)
    return rows[0] ?? null
  }

  async put(row: {
    entitySlug: string
    externalId: string
    recordId: string
    version: number
    contentHash: string
  }): Promise<void> {
    const lastSyncedAt = this.clock.now()
    await this.db
      .insert(blingSyncMap)
      .values({
        entitySlug: row.entitySlug,
        externalId: row.externalId,
        recordId: row.recordId,
        version: row.version,
        contentHash: row.contentHash,
        lastSyncedAt,
      })
      .onConflictDoUpdate({
        target: [blingSyncMap.entitySlug, blingSyncMap.externalId],
        set: {
          recordId: row.recordId,
          version: row.version,
          contentHash: row.contentHash,
          lastSyncedAt,
        },
      })
  }
}
