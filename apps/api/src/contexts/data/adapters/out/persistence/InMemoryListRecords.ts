import { ListRecords, ListRecordsOptions, RecordView } from '@/contexts/data/application/queries/ListRecords'
import { InMemoryRecordStore } from '@/contexts/data/adapters/out/persistence/InMemoryRecordStore'

// Read-side adapter (CQRS). Reads straight from the store and shapes a view —
// no domain objects. The Drizzle version writes the JSONB query here.
export class InMemoryListRecords implements ListRecords {
  constructor(private readonly store: InMemoryRecordStore) {}

  async execute(opts: ListRecordsOptions): Promise<RecordView[]> {
    const views = [...this.store.rows.values()]
      .filter((r) => r.entityId === opts.entityId)
      .map((r): RecordView => ({ id: r.id, version: r.version, data: r.data }))

    if (opts.sortBy) {
      const key = opts.sortBy
      views.sort((a, b) => String(a.data[key] ?? '').localeCompare(String(b.data[key] ?? '')))
    }
    return views
  }
}
