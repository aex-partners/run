import { RecordRow } from '@/contexts/data/application/mappers/RecordMapper'

// Shared in-memory table behind both the write repository and the read-side
// query — the analogue of one Postgres `entity_records` table serving both
// sides. In production these are separate adapters over the same DB.
export class InMemoryRecordStore {
  readonly rows = new Map<string, RecordRow>()
}
