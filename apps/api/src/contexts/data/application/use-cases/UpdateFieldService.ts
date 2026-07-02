import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { UpdateField, UpdateFieldCommand } from '@/contexts/data/application/ports/in/UpdateField'
import { EntityRepository } from '@/contexts/data/application/ports/out/EntityRepository'
import { EntityId } from '@/contexts/data/domain/EntityId'

// Ports entities.updateField (schema side). The stored record-key migration on a
// slug/type change (AEX's D1/D3) is a bulk-record persistence concern; this
// service updates the schema, leaving any key migration to the persistence layer.
export class UpdateFieldService implements UpdateField {
  constructor(
    private readonly entities: EntityRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: UpdateFieldCommand): Promise<Result<{ ok: true }>> {
    const entity = await this.entities.findById(EntityId.of(cmd.entityId))
    if (!entity) return fail('UpdateField: entity not found')

    const updated = entity.updateField(cmd.fieldId, cmd.updates, this.clock.now())
    if (!updated.ok) return fail(updated.error)

    await this.entities.save(entity)
    await this.events.publish(entity.pullEvents())
    return ok({ ok: true })
  }
}
