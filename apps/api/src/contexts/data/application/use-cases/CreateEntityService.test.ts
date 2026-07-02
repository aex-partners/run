import { describe, it, expect } from 'vitest'
import { CreateEntityService } from '@/contexts/data/application/use-cases/CreateEntityService'
import { EntityRepository } from '@/contexts/data/application/ports/out/EntityRepository'
import { EntityDefinition } from '@/contexts/data/domain/EntityDefinition'
import { EntityId } from '@/contexts/data/domain/EntityId'

// --- inline fakes --------------------------------------------------------
class FakeEntityRepository implements EntityRepository {
  store = new Map<string, EntityDefinition>()
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
    this.store.delete(id.value)
  }
}

const fakeClock = { now: () => new Date(0) }
const noopEvents = { publish: async () => {} }

describe('CreateEntityService', () => {
  it('creates an entity, returns id/slug, and persists the aggregate', async () => {
    const repo = new FakeEntityRepository()
    const service = new CreateEntityService(repo, noopEvents, fakeClock)

    const r = await service.execute({ name: 'Sales Orders', createdBy: 'u1' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.slug).toBe('sales_orders')
    expect(r.value.id).toBe('ent-1')
    // The fake repo received the saved aggregate.
    const saved = repo.store.get('ent-1')
    expect(saved).toBeDefined()
    expect(saved!.name).toBe('Sales Orders')
  })

  it('creates with initial fields', async () => {
    const repo = new FakeEntityRepository()
    const service = new CreateEntityService(repo, noopEvents, fakeClock)

    const r = await service.execute({
      name: 'Products',
      fields: [
        { name: 'title', required: true, type: { kind: 'text' } },
        { name: 'price', required: false, type: { kind: 'number' } },
      ],
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const saved = repo.store.get(r.value.id)!
    expect(saved.fields().map((f) => f.name.value)).toEqual(['title', 'price'])
  })

  it('fails on an empty name and does not persist', async () => {
    const repo = new FakeEntityRepository()
    const service = new CreateEntityService(repo, noopEvents, fakeClock)
    const r = await service.execute({ name: '   ' })
    expect(r.ok).toBe(false)
    expect(repo.store.size).toBe(0)
  })

  it('fails when an initial field is invalid (duplicate name)', async () => {
    const repo = new FakeEntityRepository()
    const service = new CreateEntityService(repo, noopEvents, fakeClock)
    const r = await service.execute({
      name: 'Dup',
      fields: [
        { name: 'a', required: false, type: { kind: 'text' } },
        { name: 'a', required: false, type: { kind: 'text' } },
      ],
    })
    expect(r.ok).toBe(false)
    expect(repo.store.size).toBe(0)
  })

  it('publishes the aggregate events', async () => {
    const repo = new FakeEntityRepository()
    const published: string[] = []
    const events = {
      publish: async (evs: { name: string }[]) => {
        for (const e of evs) published.push(e.name)
      },
    }
    const service = new CreateEntityService(repo, events, fakeClock)
    await service.execute({ name: 'Things' })
    expect(published).toContain('data.EntityCreated')
  })
})
