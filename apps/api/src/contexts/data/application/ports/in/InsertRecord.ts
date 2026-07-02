import { Result } from '@/shared/kernel/Result'
import { JsonObject } from '@/shared/domain/Json'

export interface InsertRecordCommand {
  entityId: string
  data: JsonObject
  // Acting user id, injected by the driving adapter (optional for the demo).
  createdBy?: string
}

export interface InsertRecord {
  execute(cmd: InsertRecordCommand): Promise<Result<{ id: string; version: number }>>
}
