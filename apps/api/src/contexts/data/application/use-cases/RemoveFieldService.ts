import { Result, ok, fail } from '@/shared/kernel/Result'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { RemoveField, RemoveFieldCommand } from '@/contexts/data/application/ports/in/RemoveField'
import { EntityRepository } from '@/contexts/data/application/ports/out/EntityRepository'
import { EntityId } from '@/contexts/data/domain/EntityId'

// Ports entities.removeField. Stripping the dropped field's key from stored
// records (AEX's D2) is a bulk-record persistence concern handled separately.
export class RemoveFieldService implements RemoveField {
  constructor(
    private readonly entities: EntityRepository,
    private readonly events: EventPublisher,
  ) {}

  async execute(cmd: RemoveFieldCommand): Promise<Result<{ ok: true }>> {
    const entity = await this.entities.findById(EntityId.of(cmd.entityId))
    if (!entity) return fail('RemoveField: entity not found')

    const removed = entity.removeField(cmd.fieldId)
    if (!removed.ok) return fail(removed.error)

    await this.entities.save(entity)
    await this.events.publish(entity.pullEvents())
    return ok({ ok: true })
  }
}
