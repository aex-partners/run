import { Result } from '@/shared/kernel/Result'

export interface DeleteRecordCommand {
  recordId: string
}

export interface DeleteRecord {
  execute(cmd: DeleteRecordCommand): Promise<Result<{ ok: true }>>
}
