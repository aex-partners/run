import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { entityRecords } from '@/platform/db/schema'
import { RecordRepository } from '@/contexts/data/application/ports/out/RecordRepository'
import { Record } from '@/contexts/data/domain/Record'
import { RecordId } from '@/contexts/data/domain/RecordId'
import { EntityId } from '@/contexts/data/domain/EntityId'
import { Version } from '@/contexts/data/domain/Version'

type RecordDrizzleRow = typeof entityRecords.$inferSelect

// Thrown when a compare-and-set update affects zero rows: the row's version moved
// between read and write (lost-update / concurrent edit). Mirrors AEX's
// RecordConflictError.
export class RecordConflictError extends Error {
  constructor(recordId: string) {
    super(`Record "${recordId}" was modified by another write since it was read. Re-read and retry.`)
    this.name = 'RecordConflictError'
  }
}

const toDomain = (row: RecordDrizzleRow): Record => {
  return Record.rehydrate(
    RecordId.of(row.id),
    EntityId.of(row.entityId),
    JSON.parse(row.data),
    Version.of(row.version),
    row.createdBy,
  )
}

// Driven adapter over the Postgres `entity_records` table. `data` is a JSON text
// column; concurrent writes are guarded by an optimistic version CAS
// (WHERE version = expected). A new aggregate (version 0) inserts; any other
// version updates with the predicate version = current - 1.
export class DrizzleRecordRepository implements RecordRepository {
  constructor(private readonly db: Database) {}

  nextId(): RecordId {
    return RecordId.of(randomUUID())
  }

  async findById(id: RecordId): Promise<Record | null> {
    const [row] = await this.db.select().from(entityRecords).where(eq(entityRecords.id, id.value)).limit(1)
    return row ? toDomain(row) : null
  }

  async save(record: Record): Promise<void> {
    const data = JSON.stringify(record.data)
    const version = record.version.value

    if (version === 0) {
      await this.db.insert(entityRecords).values({
        id: record.id.value,
        entityId: record.entityId.value,
        data,
        version: 0,
        createdBy: record.createdBy ?? '',
      })
      return
    }

    // Compare-and-set: only the row still at the prior version is updated.
    const updated = await this.db
      .update(entityRecords)
      .set({
        data,
        version,
        updatedAt: new Date(),
      })
      .where(and(eq(entityRecords.id, record.id.value), eq(entityRecords.version, version - 1)))
      .returning({ id: entityRecords.id })

    if (updated.length === 0) throw new RecordConflictError(record.id.value)
  }

  async delete(id: RecordId): Promise<void> {
    await this.db.delete(entityRecords).where(eq(entityRecords.id, id.value))
  }

  async exists(entityId: EntityId, id: RecordId): Promise<boolean> {
    const [row] = await this.db
      .select({ id: entityRecords.id })
      .from(entityRecords)
      .where(and(eq(entityRecords.id, id.value), eq(entityRecords.entityId, entityId.value)))
      .limit(1)
    return !!row
  }
}
