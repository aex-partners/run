import { randomUUID } from 'node:crypto'
import { EntityRepository } from '@/contexts/data/application/ports/out/EntityRepository'
import { EntityDefinition } from '@/contexts/data/domain/EntityDefinition'
import { EntityId } from '@/contexts/data/domain/EntityId'
import { EntityMapper, EntityRow } from '@/contexts/data/application/mappers/EntityMapper'

// Driven adapter. A Drizzle version stores EntityRow.fields as AEX JSON; the port
// and the mapper stay identical. Used as the test double in main.
export class InMemoryEntityRepository implements EntityRepository {
  readonly rows = new Map<string, EntityRow>()

  nextId(): EntityId {
    return EntityId.of(randomUUID())
  }

  async findById(id: EntityId): Promise<EntityDefinition | null> {
    const row = this.rows.get(id.value)
    return row ? EntityMapper.toDomain(row) : null
  }

  async findByRef(ref: string): Promise<EntityDefinition | null> {
    const row =
      this.rows.get(ref) ?? [...this.rows.values()].find((r) => r.slug === ref || r.name === ref)
    return row ? EntityMapper.toDomain(row) : null
  }

  async save(entity: EntityDefinition): Promise<void> {
    this.rows.set(entity.id.value, EntityMapper.toPersistence(entity))
  }

  async delete(id: EntityId): Promise<void> {
    this.rows.delete(id.value)
  }
}
