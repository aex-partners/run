import { describe, it, expect } from 'vitest'
import { Result, ok, fail } from '@/shared/kernel/Result'
import { GenerateFieldValueService } from '@/contexts/data/application/use-cases/GenerateFieldValueService'
import { EntityRepository } from '@/contexts/data/application/ports/out/EntityRepository'
import { RecordRepository } from '@/contexts/data/application/ports/out/RecordRepository'
import { FieldValueGenerator } from '@/contexts/data/application/ports/out/FieldValueGenerator'
import { EntityDefinition } from '@/contexts/data/domain/EntityDefinition'
import { EntityId } from '@/contexts/data/domain/EntityId'
import { RecordId } from '@/contexts/data/domain/RecordId'
import { Record } from '@/contexts/data/domain/Record'

class FakeEntityRepository implements EntityRepository {
  store = new Map<string, EntityDefinition>()
  nextId(): EntityId {
    return EntityId.of('ent-x')
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
  nextId(): RecordId {
    return RecordId.of('rec-x')
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

class FakeGenerator implements FieldValueGenerator {
  lastPrompt: string | null = null
  constructor(private readonly result: Result<string>) {}
  async generate(prompt: string): Promise<Result<string>> {
    this.lastPrompt = prompt
    return this.result
  }
}

const fakeClock = { now: () => new Date(0) }
const noopEvents = { publish: async () => {} }

const seed = (entities: FakeEntityRepository, records: FakeRecordRepository): void => {
  const created = EntityDefinition.create(EntityId.of('ent-1'), 'Companies', new Date(0))
  if (!created.ok) throw new Error(created.error)
  const e = created.value
  e.addField({ name: 'name', required: true, type: { kind: 'text' }, id: 'fld-name' }, new Date(0))
  e.addField({ name: 'summary', required: false, type: { kind: 'text' }, id: 'fld-summary' }, new Date(0))
  entities.store.set('ent-1', e)

  const rec = Record.create(RecordId.of('rec-1'), EntityId.of('ent-1'), e.toSchema(), { name: 'Acme' }, new Date(0))
  if (!rec.ok) throw new Error('seed record failed')
  rec.value.pullEvents()
  records.store.set('rec-1', rec.value)
}

describe('GenerateFieldValueService', () => {
  it('resolves {slug} placeholders, persists the generated value, and bumps version', async () => {
    const entities = new FakeEntityRepository()
    const records = new FakeRecordRepository()
    seed(entities, records)
    const generator = new FakeGenerator(ok('A great company'))
    const service = new GenerateFieldValueService(entities, records, generator, noopEvents, fakeClock)

    const r = await service.execute({
      entityId: 'ent-1',
      recordId: 'rec-1',
      fieldId: 'fld-summary',
      prompt: 'Describe {name} please',
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.value).toBe('A great company')
    expect(generator.lastPrompt).toBe('Describe Acme please')
    const saved = records.saved.at(-1)!
    expect(saved.data).toEqual({ name: 'Acme', summary: 'A great company' })
    expect(saved.version.value).toBe(1)
  })

  it('fails when the record does not exist', async () => {
    const entities = new FakeEntityRepository()
    const records = new FakeRecordRepository()
    const service = new GenerateFieldValueService(entities, records, new FakeGenerator(ok('x')), noopEvents, fakeClock)
    const r = await service.execute({ entityId: 'ent-1', recordId: 'missing', fieldId: 'fld-summary', prompt: 'p' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('record not found')
  })

  it('fails when the record does not belong to the entity', async () => {
    const entities = new FakeEntityRepository()
    const records = new FakeRecordRepository()
    seed(entities, records)
    const service = new GenerateFieldValueService(entities, records, new FakeGenerator(ok('x')), noopEvents, fakeClock)
    const r = await service.execute({ entityId: 'ent-other', recordId: 'rec-1', fieldId: 'fld-summary', prompt: 'p' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('does not belong to entity')
  })

  it('fails when the field id is unknown', async () => {
    const entities = new FakeEntityRepository()
    const records = new FakeRecordRepository()
    seed(entities, records)
    const service = new GenerateFieldValueService(entities, records, new FakeGenerator(ok('x')), noopEvents, fakeClock)
    const r = await service.execute({ entityId: 'ent-1', recordId: 'rec-1', fieldId: 'nope', prompt: 'p' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('field not found')
  })

  it('propagates a generator failure and does not save', async () => {
    const entities = new FakeEntityRepository()
    const records = new FakeRecordRepository()
    seed(entities, records)
    const service = new GenerateFieldValueService(
      entities,
      records,
      new FakeGenerator(fail('model exploded')),
      noopEvents,
      fakeClock,
    )
    const r = await service.execute({ entityId: 'ent-1', recordId: 'rec-1', fieldId: 'fld-summary', prompt: 'p' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('model exploded')
    expect(records.saved).toHaveLength(0)
  })
})
