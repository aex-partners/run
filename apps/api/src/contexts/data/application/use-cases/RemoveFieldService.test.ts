import { describe, it, expect } from 'vitest'
import { RemoveFieldService } from '@/contexts/data/application/use-cases/RemoveFieldService'
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

const noopEvents = { publish: async () => {} }

// Entity with two number fields (price id 'fld-price', qty id 'fld-qty') and a
// formula 'total' that depends on both.
const seed = (repo: FakeEntityRepository): EntityDefinition => {
  const created = EntityDefinition.create(EntityId.of('ent-1'), 'Lines', new Date(0))
  if (!created.ok) throw new Error(created.error)
  const e = created.value
  for (const [name, id] of [
    ['price', 'fld-price'],
    ['qty', 'fld-qty'],
  ]) {
    const r = e.addField({ name, required: false, type: { kind: 'number' }, id }, new Date(0))
    if (!r.ok) throw new Error(r.error)
  }
  const total = e.addField(
    { name: 'total', required: false, type: { kind: 'formula', expression: 'price * qty' }, id: 'fld-total' },
    new Date(0),
  )
  if (!total.ok) throw new Error(total.error)
  e.pullEvents()
  repo.store.set('ent-1', e)
  return e
}

describe('RemoveFieldService', () => {
  it('removes a field by id and persists', async () => {
    const repo = new FakeEntityRepository()
    const entity = seed(repo)
    const service = new RemoveFieldService(repo, noopEvents)

    const r = await service.execute({ entityId: 'ent-1', fieldId: 'fld-total' })
    expect(r.ok).toBe(true)
    expect(entity.fields().map((f) => f.name.value)).toEqual(['price', 'qty'])
    expect(repo.saves).toBe(1)
  })

  it('fails when the entity does not exist', async () => {
    const repo = new FakeEntityRepository()
    const service = new RemoveFieldService(repo, noopEvents)
    const r = await service.execute({ entityId: 'missing', fieldId: 'fld-price' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('entity not found')
  })

  it('refuses to drop a field a formula depends on and does not save', async () => {
    const repo = new FakeEntityRepository()
    seed(repo)
    const service = new RemoveFieldService(repo, noopEvents)
    const before = repo.saves
    const r = await service.execute({ entityId: 'ent-1', fieldId: 'fld-price' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('used by formula')
    expect(repo.saves).toBe(before)
  })

  it('fails when the field id is unknown', async () => {
    const repo = new FakeEntityRepository()
    seed(repo)
    const service = new RemoveFieldService(repo, noopEvents)
    const r = await service.execute({ entityId: 'ent-1', fieldId: 'nope' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('not found')
  })
})
