import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { UpdateRecord, UpdateRecordCommand } from '@/contexts/data/application/ports/in/UpdateRecord'
import { EntityRepository } from '@/contexts/data/application/ports/out/EntityRepository'
import { RecordRepository } from '@/contexts/data/application/ports/out/RecordRepository'
import { RecordId } from '@/contexts/data/domain/RecordId'
import { Version } from '@/contexts/data/domain/Version'

export class UpdateRecordService implements UpdateRecord {
  constructor(
    private readonly entities: EntityRepository,
    private readonly records: RecordRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: UpdateRecordCommand): Promise<Result<{ version: number }>> {
    const record = await this.records.findById(RecordId.of(cmd.recordId))
    if (!record) return fail('UpdateRecord: record not found')

    const entity = await this.entities.findById(record.entityId)
    if (!entity) return fail('UpdateRecord: entity not found')

    const updated = record.update(
      entity.toSchema(),
      cmd.data,
      Version.of(cmd.expectedVersion),
      this.clock.now(),
    )
    if (!updated.ok) return fail(updated.error)

    await this.records.save(record)
    await this.events.publish(record.pullEvents())
    return ok({ version: record.version.value })
  }
}
