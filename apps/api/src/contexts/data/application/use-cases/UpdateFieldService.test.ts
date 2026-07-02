import { describe, it, expect } from 'vitest'
import { UpdateFieldService } from '@/contexts/data/application/use-cases/UpdateFieldService'
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

// Seeds an entity with a single text field whose stable id is 'fld-title'.
const seed = (repo: FakeEntityRepository): EntityDefinition => {
  const created = EntityDefinition.create(EntityId.of('ent-1'), 'Things', new Date(0))
  if (!created.ok) throw new Error(created.error)
  const added = created.value.addField(
    { name: 'title', required: false, type: { kind: 'text' }, id: 'fld-title' },
    new Date(0),
  )
  if (!added.ok) throw new Error(added.error)
  created.value.pullEvents()
  repo.store.set('ent-1', created.value)
  return created.value
}

describe('UpdateFieldService', () => {
  it('updates a field by id (rename + required) and persists', async () => {
    const repo = new FakeEntityRepository()
    const entity = seed(repo)
    const service = new UpdateFieldService(repo, noopEvents, fakeClock)

    const r = await service.execute({
      entityId: 'ent-1',
      fieldId: 'fld-title',
      updates: { name: 'Headline', required: true },
    })
    expect(r.ok).toBe(true)
    const field = entity.fieldById('fld-title')!
    expect(field.name.value).toBe('headline') // slug re-derived from the new name
    expect(field.required).toBe(true)
    expect(repo.saves).toBe(1)
  })

  it('fails when the entity does not exist', async () => {
    const repo = new FakeEntityRepository()
    const service = new UpdateFieldService(repo, noopEvents, fakeClock)
    const r = await service.execute({ entityId: 'missing', fieldId: 'fld-title', updates: {} })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('entity not found')
  })

  it('fails when the field id is unknown and does not save', async () => {
    const repo = new FakeEntityRepository()
    seed(repo)
    const service = new UpdateFieldService(repo, noopEvents, fakeClock)
    const before = repo.saves
    const r = await service.execute({ entityId: 'ent-1', fieldId: 'nope', updates: { required: true } })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('not found')
    expect(repo.saves).toBe(before)
  })
})
