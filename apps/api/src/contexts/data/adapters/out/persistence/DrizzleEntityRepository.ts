import { randomUUID } from 'node:crypto'
import { eq, or } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { entities } from '@/platform/db/schema'
import { EntityRepository } from '@/contexts/data/application/ports/out/EntityRepository'
import { EntityDefinition } from '@/contexts/data/domain/EntityDefinition'
import { EntityId } from '@/contexts/data/domain/EntityId'
import { DrizzleEntityMapper } from '@/contexts/data/adapters/out/persistence/DrizzleEntityMapper'

// Driven adapter over the Postgres `entities` table. The dynamic schema is stored
// in the `fields` JSON text column in AEX's exact shape (see DrizzleEntityMapper).
export class DrizzleEntityRepository implements EntityRepository {
  constructor(private readonly db: Database) {}

  nextId(): EntityId {
    return EntityId.of(randomUUID())
  }

  async findById(id: EntityId): Promise<EntityDefinition | null> {
    const [row] = await this.db.select().from(entities).where(eq(entities.id, id.value)).limit(1)
    return row ? DrizzleEntityMapper.toDomain(row) : null
  }

  async findByRef(ref: string): Promise<EntityDefinition | null> {
    const [row] = await this.db
      .select()
      .from(entities)
      .where(or(eq(entities.id, ref), eq(entities.slug, ref), eq(entities.name, ref)))
      .limit(1)
    return row ? DrizzleEntityMapper.toDomain(row) : null
  }

  async save(entity: EntityDefinition): Promise<void> {
    const values = DrizzleEntityMapper.toInsert(entity)
    await this.db
      .insert(entities)
      .values(values)
      .onConflictDoUpdate({
        target: entities.id,
        set: {
          name: values.name,
          slug: values.slug,
          description: values.description,
          fields: values.fields,
          updatedAt: new Date(),
        },
      })
  }

  async delete(id: EntityId): Promise<void> {
    await this.db.delete(entities).where(eq(entities.id, id.value))
  }
}
