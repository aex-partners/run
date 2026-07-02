import { describe, it, expect } from 'vitest'
import { UpdateEntityService } from '@/contexts/data/application/use-cases/UpdateEntityService'
import { EntityRepository } from '@/contexts/data/application/ports/out/EntityRepository'
import { EntityDefinition } from '@/contexts/data/domain/EntityDefinition'
import { EntityId } from '@/contexts/data/domain/EntityId'

class FakeEntityRepository implements EntityRepository {
  store = new Map<string, EntityDefinition>()
  saves = 0
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
    this.saves++
    this.store.set(entity.id.value, entity)
  }
  async delete(id: EntityId): Promise<void> {
    this.store.delete(id.value)
  }
}

const fakeClock = { now: () => new Date(0) }
const noopEvents = { publish: async () => {} }

const seed = (repo: FakeEntityRepository): EntityDefinition => {
  const created = EntityDefinition.create(EntityId.of('ent-1'), 'Things', new Date(0))
  if (!created.ok) throw new Error(created.error)
  created.value.pullEvents()
  repo.store.set('ent-1', created.value)
  return created.value
}

describe('UpdateEntityService', () => {
  it('renames the entity and re-derives the slug', async () => {
    const repo = new FakeEntityRepository()
    const entity = seed(repo)
    const service = new UpdateEntityService(repo, noopEvents, fakeClock)

    const r = await service.execute({ entityId: 'ent-1', name: 'Sales Orders' })
    expect(r.ok).toBe(true)
    expect(entity.name).toBe('Sales Orders')
    expect(entity.slug).toBe('sales_orders')
    expect(repo.saves).toBe(1)
  })

  it('updates the description', async () => {
    const repo = new FakeEntityRepository()
    const entity = seed(repo)
    const service = new UpdateEntityService(repo, noopEvents, fakeClock)

    const r = await service.execute({ entityId: 'ent-1', description: 'a desc' })
    expect(r.ok).toBe(true)
    expect(entity.description).toBe('a desc')
  })

  it('applies both name and description at once', async () => {
    const repo = new FakeEntityRepository()
    const entity = seed(repo)
    const service = new UpdateEntityService(repo, noopEvents, fakeClock)

    const r = await service.execute({ entityId: 'ent-1', name: 'Renamed', description: 'd' })
    expect(r.ok).toBe(true)
    expect(entity.name).toBe('Renamed')
    expect(entity.description).toBe('d')
  })

  it('publishes an EntityUpdated event', async () => {
    const repo = new FakeEntityRepository()
    seed(repo)
    const published: string[] = []
    const events = {
      publish: async (evs: { name: string }[]) => {
        for (const e of evs) published.push(e.name)
      },
    }
    const service = new UpdateEntityService(repo, events, fakeClock)
    await service.execute({ entityId: 'ent-1', name: 'X' })
    expect(published).toContain('data.EntityUpdated')
  })

  it('fails when the entity does not exist', async () => {
    const repo = new FakeEntityRepository()
    const service = new UpdateEntityService(repo, noopEvents, fakeClock)
    const r = await service.execute({ entityId: 'missing', name: 'X' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('entity not found')
  })

  it('fails on an empty rename and does not save', async () => {
    const repo = new FakeEntityRepository()
    seed(repo)
    const service = new UpdateEntityService(repo, noopEvents, fakeClock)
    const before = repo.saves
    const r = await service.execute({ entityId: 'ent-1', name: '   ' })
    expect(r.ok).toBe(false)
    expect(repo.saves).toBe(before)
  })
})
