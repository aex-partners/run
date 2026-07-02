import { describe, it, expect } from 'vitest'
import { AddFieldService } from '@/contexts/data/application/use-cases/AddFieldService'
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

const seedEntity = (repo: FakeEntityRepository): EntityDefinition => {
  const created = EntityDefinition.create(EntityId.of('ent-1'), 'Things', new Date(0))
  if (!created.ok) throw new Error(created.error)
  created.value.pullEvents()
  repo.store.set('ent-1', created.value)
  return created.value
}

describe('AddFieldService', () => {
  it('adds a field, returns its id, and persists the updated aggregate', async () => {
    const repo = new FakeEntityRepository()
    const entity = seedEntity(repo)
    const service = new AddFieldService(repo, noopEvents, fakeClock)

    const r = await service.execute({
      entityId: 'ent-1',
      name: 'title',
      required: true,
      type: { kind: 'text' },
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.id).toBe('title') // defaults field id to name when none given
    expect(repo.saves).toBe(1)
    expect(entity.fields().map((f) => f.name.value)).toEqual(['title'])
  })

  it('uses the supplied field id when provided', async () => {
    const repo = new FakeEntityRepository()
    seedEntity(repo)
    const service = new AddFieldService(repo, noopEvents, fakeClock)
    const r = await service.execute({
      entityId: 'ent-1',
      name: 'title',
      required: false,
      type: { kind: 'text' },
      id: 'fld-123',
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.id).toBe('fld-123')
  })

  it('fails when the entity does not exist', async () => {
    const repo = new FakeEntityRepository()
    const service = new AddFieldService(repo, noopEvents, fakeClock)
    const r = await service.execute({
      entityId: 'missing',
      name: 'title',
      required: false,
      type: { kind: 'text' },
    })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('entity not found')
  })

  it('fails on a duplicate field and does not persist', async () => {
    const repo = new FakeEntityRepository()
    seedEntity(repo)
    const service = new AddFieldService(repo, noopEvents, fakeClock)
    await service.execute({ entityId: 'ent-1', name: 'title', required: false, type: { kind: 'text' } })
    const before = repo.saves
    const r = await service.execute({
      entityId: 'ent-1',
      name: 'title',
      required: false,
      type: { kind: 'text' },
    })
    expect(r.ok).toBe(false)
    expect(repo.saves).toBe(before) // no extra save
  })
})
