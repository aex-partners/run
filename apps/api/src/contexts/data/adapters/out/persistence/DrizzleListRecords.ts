import { desc, eq } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { entityRecords } from '@/platform/db/schema'
import { ListRecords, ListRecordsOptions, RecordView } from '@/contexts/data/application/queries/ListRecords'
import { JsonObject } from '@/shared/domain/Json'

// Read-side adapter (CQRS). Reads the entity's records straight from
// `entity_records` and shapes a view — no domain objects. Relationship-label and
// lookup/rollup display resolution (AEX's read-side enrichment) is intentionally
// not ported here; it is a presentation concern over separate helpers.
export class DrizzleListRecords implements ListRecords {
  constructor(private readonly db: Database) {}

  async execute(opts: ListRecordsOptions): Promise<RecordView[]> {
    const rows = await this.db
      .select({ id: entityRecords.id, data: entityRecords.data, version: entityRecords.version })
      .from(entityRecords)
      .where(eq(entityRecords.entityId, opts.entityId))
      .orderBy(desc(entityRecords.createdAt))

    const views = rows.map((r): RecordView => ({
      id: r.id,
      version: r.version,
      data: JSON.parse(r.data) as JsonObject,
    }))

    if (opts.sortBy) {
      const key = opts.sortBy
      views.sort((a, b) => String(a.data[key] ?? '').localeCompare(String(b.data[key] ?? '')))
    }
    return views
  }
}
