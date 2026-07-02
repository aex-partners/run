import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { UpdateEntity, UpdateEntityCommand } from '@/contexts/data/application/ports/in/UpdateEntity'
import { EntityRepository } from '@/contexts/data/application/ports/out/EntityRepository'
import { EntityId } from '@/contexts/data/domain/EntityId'

// Covers entities.renameEntity + entities.updateDescription.
export class UpdateEntityService implements UpdateEntity {
  constructor(
    private readonly entities: EntityRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: UpdateEntityCommand): Promise<Result<{ ok: true }>> {
    const entity = await this.entities.findById(EntityId.of(cmd.entityId))
    if (!entity) return fail('UpdateEntity: entity not found')

    if (cmd.name !== undefined) {
      const renamed = entity.rename(cmd.name, this.clock.now())
      if (!renamed.ok) return fail(renamed.error)
    }
    if (cmd.description !== undefined) {
      const described = entity.describe(cmd.description, this.clock.now())
      if (!described.ok) return fail(described.error)
    }

    await this.entities.save(entity)
    await this.events.publish(entity.pullEvents())
    return ok({ ok: true })
  }
}
