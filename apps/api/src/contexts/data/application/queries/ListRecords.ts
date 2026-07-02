import { Json } from '@/shared/domain/Json'

// Read side (CQRS). Bypasses the domain entirely: no aggregate, no repo, no
// mapper round-trip. An adapter answers it with a direct query
// (e.g. WHERE data->>'field' = $1 against Postgres JSONB).
export interface RecordView {
  id: string
  version: number
  data: { [key: string]: Json }
}

export interface ListRecordsOptions {
  entityId: string
  sortBy?: string
}

export interface ListRecords {
  execute(opts: ListRecordsOptions): Promise<RecordView[]>
}
