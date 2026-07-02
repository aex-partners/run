import { describe, it, expect } from 'vitest'
import { DeleteEntityService } from '@/contexts/data/application/use-cases/DeleteEntityService'
import { EntityRepository } from '@/contexts/data/application/ports/out/EntityRepository'
import { EntityDefinition } from '@/contexts/data/domain/EntityDefinition'
import { EntityId } from '@/contexts/data/domain/EntityId'

class FakeEntityRepository implements EntityRepository {
  store = new Map<string, EntityDefinition>()
  deleted: string[] = []
  private seq = 0
  nextId(): EntityId {
    return EntityId.of(`ent-${++this.seq}`)
  }
  async findById(id: EntityId): Promise<EntityDefinition | null> {
    return this.store.get(id.value) ?? null
  }
  async findByRef(ref: string): Promise<EntityDefinition | null> {
    return this.store.get(ref) ?? null
  }
  async save(entity: EntityDefinition): Promise<void> {
    this.store.set(entity.id.value, entity)
  }
  async delete(id: EntityId): Promise<void> {
    this.deleted.push(id.value)
    this.store.delete(id.value)
  }
}

describe('DeleteEntityService', () => {
  it('deletes the entity by id and returns ok', async () => {
    const repo = new FakeEntityRepository()
    const created = EntityDefinition.create(EntityId.of('ent-1'), 'Things', new Date(0))
    if (!created.ok) throw new Error(created.error)
    repo.store.set('ent-1', created.value)
    const service = new DeleteEntityService(repo)

    const r = await service.execute({ entityId: 'ent-1' })
    expect(r.ok).toBe(true)
    expect(repo.deleted).toEqual(['ent-1'])
    expect(repo.store.has('ent-1')).toBe(false)
  })

  it('is idempotent: deleting a missing entity still returns ok', async () => {
    const repo = new FakeEntityRepository()
    const service = new DeleteEntityService(repo)
    const r = await service.execute({ entityId: 'missing' })
    expect(r.ok).toBe(true)
    expect(repo.deleted).toEqual(['missing'])
  })
})
