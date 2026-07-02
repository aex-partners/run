import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { CreateEntity, CreateEntityCommand } from '@/contexts/data/application/ports/in/CreateEntity'
import { EntityRepository } from '@/contexts/data/application/ports/out/EntityRepository'
import { EntityDefinition, FieldDescriptor } from '@/contexts/data/domain/EntityDefinition'

// Application service. No business rule: builds the aggregate (rules live in the
// factory + addField invariants), persists, publishes events. Depends ONLY on
// ports.
export class CreateEntityService implements CreateEntity {
  constructor(
    private readonly entities: EntityRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: CreateEntityCommand): Promise<Result<{ id: string; slug: string }>> {
    const id = this.entities.nextId()
    const entity = EntityDefinition.create(id, cmd.name, this.clock.now(), {
      createdBy: cmd.createdBy,
      description: cmd.description,
    })
    if (!entity.ok) return fail(entity.error)

    for (const f of cmd.fields ?? []) {
      const descriptor: FieldDescriptor = {
        name: f.name,
        required: f.required,
        type: f.type,
        id: f.id,
        displayName: f.displayName,
        unique: f.unique,
        description: f.description,
        defaultValue: f.defaultValue,
      }
      const added = entity.value.addField(descriptor, this.clock.now())
      if (!added.ok) return fail(added.error)
    }

    await this.entities.save(entity.value)
    await this.events.publish(entity.value.pullEvents())
    return ok({ id: id.value, slug: entity.value.slug })
  }
}
