import { JsonObject } from '@/shared/domain/Json'

export interface GetRecordQuery {
  recordId: string
}

export interface GetRecordView {
  id: string
  data: JsonObject
  version: number
}

export interface GetRecord {
  execute(query: GetRecordQuery): Promise<GetRecordView | null>
}
