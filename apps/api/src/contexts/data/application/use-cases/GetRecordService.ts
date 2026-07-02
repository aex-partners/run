import { GetRecord, GetRecordQuery, GetRecordView } from '@/contexts/data/application/ports/in/GetRecord'
import { RecordRepository } from '@/contexts/data/application/ports/out/RecordRepository'
import { RecordId } from '@/contexts/data/domain/RecordId'

// Read-side: fetch one record's data + optimistic version by id. Generic and
// source-agnostic; used by the UI and by the bling RecordSink (to read the
// current version before an overwriting update).
export class GetRecordService implements GetRecord {
  constructor(private readonly records: RecordRepository) {}

  async execute(query: GetRecordQuery): Promise<GetRecordView | null> {
    const record = await this.records.findById(RecordId.of(query.recordId))
    if (!record) return null
    return { id: query.recordId, data: record.data, version: record.version.value }
  }
}
