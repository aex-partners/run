import { desc, eq } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { entities, entityRecords } from '@/platform/db/schema'
import {
  SearchRecords,
  SearchRecordsOptions,
  RecordLabel,
} from '@/contexts/data/application/queries/SearchRecords'
import { Field } from '@/contexts/data/domain/Field'
import { DrizzleEntityMapper } from '@/contexts/data/adapters/out/persistence/DrizzleEntityMapper'

// Pick a record's human-readable label field: first required text field, else
// first text field, else first field. Ports labelFieldFor.
const labelFieldFor = (fields: readonly Field[]): Field | undefined =>
  fields.find((f) => f.type.kind === 'text' && f.required) ??
  fields.find((f) => f.type.kind === 'text') ??
  fields[0]

// Read-side adapter. Ports entities.searchRecords: label-based fuzzy search for
// the relationship picker.
export class DrizzleSearchRecords implements SearchRecords {
  constructor(private readonly db: Database) {}

  async execute(opts: SearchRecordsOptions): Promise<RecordLabel[]> {
    const [entityRow] = await this.db
      .select()
      .from(entities)
      .where(eq(entities.id, opts.entityId))
      .limit(1)
    if (!entityRow) return []

    const fields = DrizzleEntityMapper.toDomain(entityRow).fields()
    const labelField = labelFieldFor(fields)
    const limit = opts.limit ?? 20
    const search = (opts.search ?? '').toLowerCase()
    const fetchLimit = search ? 500 : limit

    const rows = await this.db
      .select({ id: entityRecords.id, data: entityRecords.data })
      .from(entityRecords)
      .where(eq(entityRecords.entityId, opts.entityId))
      .orderBy(desc(entityRecords.createdAt))
      .limit(fetchLimit)

    return rows
      .map((r) => {
        const data = JSON.parse(r.data) as Record<string, unknown>
        const raw = labelField ? data[labelField.name.value] : undefined
        const label = raw === undefined || raw === null ? r.id : String(raw)
        return { id: r.id, label }
      })
      .filter((r) => (search ? r.label.toLowerCase().includes(search) : true))
      .slice(0, limit)
  }
}
