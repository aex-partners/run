import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { JsonObject } from '@/shared/domain/Json'
import {
  GenerateFieldValue,
  GenerateFieldValueCommand,
} from '@/contexts/data/application/ports/in/GenerateFieldValue'
import { EntityRepository } from '@/contexts/data/application/ports/out/EntityRepository'
import { RecordRepository } from '@/contexts/data/application/ports/out/RecordRepository'
import { FieldValueGenerator } from '@/contexts/data/application/ports/out/FieldValueGenerator'
import { EntityId } from '@/contexts/data/domain/EntityId'
import { RecordId } from '@/contexts/data/domain/RecordId'

// Ports entities.generateFieldValue. Resolves {slug} placeholders in the prompt
// from the record's current data, asks the model via the FieldValueGenerator
// out-port, then persists ONLY that field via the aggregate's version CAS.
export class GenerateFieldValueService implements GenerateFieldValue {
  constructor(
    private readonly entities: EntityRepository,
    private readonly records: RecordRepository,
    private readonly generator: FieldValueGenerator,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: GenerateFieldValueCommand): Promise<Result<{ value: string }>> {
    const record = await this.records.findById(RecordId.of(cmd.recordId))
    if (!record) return fail('GenerateFieldValue: record not found')
    if (record.entityId.value !== cmd.entityId) {
      return fail('GenerateFieldValue: record does not belong to entity')
    }

    const entity = await this.entities.findById(EntityId.of(cmd.entityId))
    if (!entity) return fail('GenerateFieldValue: entity not found')

    const field = entity.fieldById(cmd.fieldId)
    if (!field) return fail('GenerateFieldValue: field not found')

    // Replace {slug} placeholders with the record's current values.
    let resolvedPrompt = cmd.prompt
    for (const f of entity.fields()) {
      const slug = f.name.value
      const value = record.data[slug]
      resolvedPrompt = resolvedPrompt.split(`{${slug}}`).join(String(value ?? ''))
    }

    const generated = await this.generator.generate(resolvedPrompt)
    if (!generated.ok) return fail(generated.error)

    const nextData: JsonObject = { ...record.data, [field.name.value]: generated.value }
    const updated = record.update(entity.toSchema(), nextData, record.version, this.clock.now())
    if (!updated.ok) return fail(updated.error)

    await this.records.save(record)
    await this.events.publish(record.pullEvents())
    return ok({ value: generated.value })
  }
}
