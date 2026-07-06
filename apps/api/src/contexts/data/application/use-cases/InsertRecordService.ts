import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { Json } from '@/shared/domain/Json'
import { InsertRecord, InsertRecordCommand } from '@/contexts/data/application/ports/in/InsertRecord'
import { EntityRepository } from '@/contexts/data/application/ports/out/EntityRepository'
import { RecordRepository } from '@/contexts/data/application/ports/out/RecordRepository'
import { EntityId } from '@/contexts/data/domain/EntityId'
import { RecordId } from '@/contexts/data/domain/RecordId'
import { RelationFieldType } from '@/contexts/data/domain/FieldType'
import { Record } from '@/contexts/data/domain/Record'

export class InsertRecordService implements InsertRecord {
  constructor(
    private readonly entities: EntityRepository,
    private readonly records: RecordRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: InsertRecordCommand): Promise<Result<{ id: string; version: number }>> {
    const entity = await this.entities.findById(EntityId.of(cmd.entityId))
    if (!entity) return fail('InsertRecord: entity not found')

    // Apply per-field default values for any key the caller omitted (or left
    // null). Defaults belong to INSERT only: an update carries the full record,
    // so re-applying a default there would resurrect a value the user cleared.
    const data = { ...cmd.data }
    for (const field of entity.fields()) {
      const def = field.meta.defaultValue
      if (def == null || def === '') continue
      if (data[field.name.value] == null) data[field.name.value] = def
    }

    // Cross-aggregate referential integrity: relation targets must exist. This
    // lives in the service, not the Record aggregate.
    for (const field of entity.fields()) {
      if (!(field.type instanceof RelationFieldType)) continue
      const value: Json = data[field.name.value] ?? null
      if (typeof value !== 'string') continue
      const present = await this.records.exists(
        EntityId.of(field.type.targetEntityId),
        RecordId.of(value),
      )
      if (!present) return fail(`InsertRecord: relation "${field.name.value}" target not found`)
    }

    const id = this.records.nextId()
    const record = Record.create(id, entity.id, entity.toSchema(), data, this.clock.now(), {
      createdBy: cmd.createdBy,
    })
    if (!record.ok) return fail(record.error)

    await this.records.save(record.value)
    await this.events.publish(record.value.pullEvents())
    return ok({ id: id.value, version: record.value.version.value })
  }
}
