import { Result } from '@/shared/kernel/Result'
import { JsonObject } from '@/shared/domain/Json'

export interface UpdateRecordCommand {
  recordId: string
  data: JsonObject
  expectedVersion: number
}

export interface UpdateRecord {
  execute(cmd: UpdateRecordCommand): Promise<Result<{ version: number }>>
}
