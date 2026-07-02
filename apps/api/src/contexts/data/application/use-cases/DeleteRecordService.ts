import { Result, ok, fail } from '@/shared/kernel/Result'
import { DeleteRecord, DeleteRecordCommand } from '@/contexts/data/application/ports/in/DeleteRecord'
import { RecordRepository } from '@/contexts/data/application/ports/out/RecordRepository'
import { RecordId } from '@/contexts/data/domain/RecordId'

// Ports entities.deleteRecord / the AI delete_record tool.
export class DeleteRecordService implements DeleteRecord {
  constructor(private readonly records: RecordRepository) {}

  async execute(cmd: DeleteRecordCommand): Promise<Result<{ ok: true }>> {
    const id = RecordId.of(cmd.recordId)
    const record = await this.records.findById(id)
    if (!record) return fail('DeleteRecord: record not found')

    await this.records.delete(id)
    return ok({ ok: true })
  }
}
