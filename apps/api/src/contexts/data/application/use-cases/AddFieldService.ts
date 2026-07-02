import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { AddField, AddFieldCommand } from '@/contexts/data/application/ports/in/AddField'
import { EntityRepository } from '@/contexts/data/application/ports/out/EntityRepository'
import { EntityId } from '@/contexts/data/domain/EntityId'

export class AddFieldService implements AddField {
  constructor(
    private readonly entities: EntityRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: AddFieldCommand): Promise<Result<{ id: string }>> {
    const entity = await this.entities.findById(EntityId.of(cmd.entityId))
    if (!entity) return fail('AddField: entity not found')

    const fieldId = cmd.id ?? cmd.name
    const added = entity.addField(
      {
        name: cmd.name,
        required: cmd.required,
        type: cmd.type,
        id: fieldId,
        displayName: cmd.displayName,
        unique: cmd.unique,
        description: cmd.description,
        defaultValue: cmd.defaultValue,
      },
      this.clock.now(),
    )
    if (!added.ok) return fail(added.error)

    await this.entities.save(entity)
    await this.events.publish(entity.pullEvents())
    return ok({ id: fieldId })
  }
}
