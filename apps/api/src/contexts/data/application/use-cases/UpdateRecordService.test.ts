import { describe, it, expect } from 'vitest'
import { UpdateRecordService } from '@/contexts/data/application/use-cases/UpdateRecordService'
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
  saved: Record[] = []
  private seq = 0
  nextId(): RecordId {
    return RecordId.of(`rec-${++this.seq}`)
  }
  async findById(id: RecordId): Promise<Record | null> {
    return this.store.get(id.value) ?? null
  }
  async save(record: Record): Promise<void> {
    this.saved.push(record)
    this.store.set(record.id.value, record)
  }
  async delete(id: RecordId): Promise<void> {
    this.store.delete(id.value)
  }
  async exists(): Promise<boolean> {
    return true
  }
}

const fakeClock = { now: () => new Date(0) }
const noopEvents = { publish: async () => {} }

// Seeds an entity (one required text field) and a record at version 0.
const seed = (entities: FakeEntityRepository, records: FakeRecordRepository): Record => {
  const e = EntityDefinition.create(EntityId.of('ent-1'), 'Things', new Date(0))
  if (!e.ok) throw new Error(e.error)
  e.value.addField({ name: 'name', required: true, type: { kind: 'text' } }, new Date(0))
  entities.store.set('ent-1', e.value)

  const rec = Record.create(
    RecordId.of('rec-1'),
    EntityId.of('ent-1'),
    e.value.toSchema(),
    { name: 'Acme' },
    new Date(0),
  )
  if (!rec.ok) throw new Error('seed record failed')
  rec.value.pullEvents()
  records.store.set('rec-1', rec.value)
  return rec.value
}

describe('UpdateRecordService', () => {
  it('updates on a matching expected version and bumps it', async () => {
    const entities = new FakeEntityRepository()
    const records = new FakeRecordRepository()
    const rec = seed(entities, records)
    const service = new UpdateRecordService(entities, records, noopEvents, fakeClock)

    const r = await service.execute({ recordId: 'rec-1', data: { name: 'Beta' }, expectedVersion: 0 })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.version).toBe(1)
    expect(rec.data).toEqual({ name: 'Beta' })
    // The fake repo received the saved aggregate.
    expect(records.saved.at(-1)).toBe(rec)
  })

  it('fails with a version conflict on a wrong expected version', async () => {
    const entities = new FakeEntityRepository()
    const records = new FakeRecordRepository()
    const rec = seed(entities, records)
    const service = new UpdateRecordService(entities, records, noopEvents, fakeClock)

    const r = await service.execute({ recordId: 'rec-1', data: { name: 'Beta' }, expectedVersion: 7 })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('version conflict')
    expect(rec.version.value).toBe(0) // unchanged
    expect(records.saved).toHaveLength(0) // never saved
  })

  it('fails when the record does not exist', async () => {
    const entities = new FakeEntityRepository()
    const records = new FakeRecordRepository()
    const service = new UpdateRecordService(entities, records, noopEvents, fakeClock)
    const r = await service.execute({ recordId: 'missing', data: {}, expectedVersion: 0 })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('record not found')
  })

  it('fails when the parent entity is gone', async () => {
    const entities = new FakeEntityRepository()
    const records = new FakeRecordRepository()
    seed(entities, records)
    entities.store.delete('ent-1') // orphan the record
    const service = new UpdateRecordService(entities, records, noopEvents, fakeClock)
    const r = await service.execute({ recordId: 'rec-1', data: { name: 'X' }, expectedVersion: 0 })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('entity not found')
  })

  it('fails when the new data violates the schema', async () => {
    const entities = new FakeEntityRepository()
    const records = new FakeRecordRepository()
    seed(entities, records)
    const service = new UpdateRecordService(entities, records, noopEvents, fakeClock)
    const r = await service.execute({ recordId: 'rec-1', data: {}, expectedVersion: 0 })
    expect(r.ok).toBe(false)
    expect(records.saved).toHaveLength(0)
  })
})
