import { describe, it, expect } from 'vitest'
import { InsertRecordService } from '@/contexts/data/application/use-cases/InsertRecordService'
import { EntityRepository } from '@/contexts/data/application/ports/out/EntityRepository'
import { RecordRepository } from '@/contexts/data/application/ports/out/RecordRepository'
import { EntityDefinition } from '@/contexts/data/domain/EntityDefinition'
import { EntityId } from '@/contexts/data/domain/EntityId'
import { RecordId } from '@/contexts/data/domain/RecordId'
import { Record } from '@/contexts/data/domain/Record'

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

class FakeRecordRepository implements RecordRepository {
  store = new Map<string, Record>()
  existing = new Set<string>() // `${entityId}:${recordId}` keys that "exist"
  private seq = 0
  nextId(): RecordId {
    return RecordId.of(`rec-${++this.seq}`)
  }
  async findById(id: RecordId): Promise<Record | null> {
    return this.store.get(id.value) ?? null
  }
  async save(record: Record): Promise<void> {
    this.store.set(record.id.value, record)
  }
  async delete(id: RecordId): Promise<void> {
    this.store.delete(id.value)
  }
  async exists(entityId: EntityId, id: RecordId): Promise<boolean> {
    return this.existing.has(`${entityId.value}:${id.value}`)
  }
}

const fakeClock = { now: () => new Date(0) }
const noopEvents = { publish: async () => {} }

const seedEntity = (repo: FakeEntityRepository): void => {
  const e = EntityDefinition.create(EntityId.of('ent-1'), 'Products', new Date(0))
  if (!e.ok) throw new Error(e.error)
  e.value.addField({ name: 'title', required: true, type: { kind: 'text' } }, new Date(0))
  e.value.addField({ name: 'price', required: false, type: { kind: 'number' } }, new Date(0))
  repo.store.set('ent-1', e.value)
}

const seedEntityWithRelation = (repo: FakeEntityRepository): void => {
  const e = EntityDefinition.create(EntityId.of('ent-1'), 'Orders', new Date(0))
  if (!e.ok) throw new Error(e.error)
  e.value.addField(
    { name: 'customer', required: false, type: { kind: 'relation', targetEntityId: 'ent-cust' } },
    new Date(0),
  )
  repo.store.set('ent-1', e.value)
}

describe('InsertRecordService', () => {
  it('inserts a valid record and persists it at version 0', async () => {
    const entities = new FakeEntityRepository()
    const records = new FakeRecordRepository()
    seedEntity(entities)
    const service = new InsertRecordService(entities, records, noopEvents, fakeClock)

    const r = await service.execute({ entityId: 'ent-1', data: { title: 'Widget', price: 9 } })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.version).toBe(0)
    expect(r.value.id).toBe('rec-1')
    const saved = records.store.get('rec-1')
    expect(saved).toBeDefined()
    expect(saved!.data).toEqual({ title: 'Widget', price: 9 })
  })

  it('fails when the entity does not exist', async () => {
    const entities = new FakeEntityRepository()
    const records = new FakeRecordRepository()
    const service = new InsertRecordService(entities, records, noopEvents, fakeClock)
    const r = await service.execute({ entityId: 'missing', data: {} })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('entity not found')
  })

  it('fails schema validation (missing required field) without saving', async () => {
    const entities = new FakeEntityRepository()
    const records = new FakeRecordRepository()
    seedEntity(entities)
    const service = new InsertRecordService(entities, records, noopEvents, fakeClock)
    const r = await service.execute({ entityId: 'ent-1', data: { price: 5 } })
    expect(r.ok).toBe(false)
    expect(records.store.size).toBe(0)
  })

  it('fails when a relation target does not exist', async () => {
    const entities = new FakeEntityRepository()
    const records = new FakeRecordRepository()
    seedEntityWithRelation(entities)
    const service = new InsertRecordService(entities, records, noopEvents, fakeClock)

    const r = await service.execute({ entityId: 'ent-1', data: { customer: 'rec-x' } })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('relation "customer" target not found')
    expect(records.store.size).toBe(0)
  })

  it('passes the relation existence check via records.exists', async () => {
    const entities = new FakeEntityRepository()
    const records = new FakeRecordRepository()
    seedEntityWithRelation(entities)
    records.existing.add('ent-cust:rec-x') // the target now exists
    const service = new InsertRecordService(entities, records, noopEvents, fakeClock)

    const r = await service.execute({ entityId: 'ent-1', data: { customer: 'rec-x' } })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(records.store.get(r.value.id)!.data).toEqual({ customer: 'rec-x' })
  })

  it('applies a field default when the key is omitted (satisfies required)', async () => {
    const entities = new FakeEntityRepository()
    const records = new FakeRecordRepository()
    const e = EntityDefinition.create(EntityId.of('ent-1'), 'Notes', new Date(0))
    if (!e.ok) throw new Error(e.error)
    e.value.addField({ name: 'title', required: true, type: { kind: 'text' } }, new Date(0))
    e.value.addField({ name: 'origin', required: true, type: { kind: 'text' }, defaultValue: 'web' }, new Date(0))
    entities.store.set('ent-1', e.value)
    const service = new InsertRecordService(entities, records, noopEvents, fakeClock)

    const r = await service.execute({ entityId: 'ent-1', data: { title: 'Hi' } })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    // the default fills the omitted required field → validation passes + persists it
    expect(records.store.get(r.value.id)!.data).toEqual({ title: 'Hi', origin: 'web' })
  })

  it('keeps an explicit value over the field default', async () => {
    const entities = new FakeEntityRepository()
    const records = new FakeRecordRepository()
    const e = EntityDefinition.create(EntityId.of('ent-1'), 'Notes', new Date(0))
    if (!e.ok) throw new Error(e.error)
    e.value.addField({ name: 'title', required: true, type: { kind: 'text' } }, new Date(0))
    e.value.addField({ name: 'origin', required: false, type: { kind: 'text' }, defaultValue: 'web' }, new Date(0))
    entities.store.set('ent-1', e.value)
    const service = new InsertRecordService(entities, records, noopEvents, fakeClock)

    const r = await service.execute({ entityId: 'ent-1', data: { title: 'Hi', origin: 'mobile' } })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(records.store.get(r.value.id)!.data).toEqual({ title: 'Hi', origin: 'mobile' })
  })
})
