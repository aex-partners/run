import { Result, ok } from '@/shared/kernel/Result'
import { DeleteEntity, DeleteEntityCommand } from '@/contexts/data/application/ports/in/DeleteEntity'
import { EntityRepository } from '@/contexts/data/application/ports/out/EntityRepository'
import { EntityId } from '@/contexts/data/domain/EntityId'

// Ports entities.deleteEntity. The DB cascades entity_records on delete.
export class DeleteEntityService implements DeleteEntity {
  constructor(private readonly entities: EntityRepository) {}

  async execute(cmd: DeleteEntityCommand): Promise<Result<{ ok: true }>> {
    await this.entities.delete(EntityId.of(cmd.entityId))
    return ok({ ok: true })
  }
}
