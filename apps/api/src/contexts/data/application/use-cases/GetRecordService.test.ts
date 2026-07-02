import { describe, it, expect } from 'vitest'
import { GetRecordService } from '@/contexts/data/application/use-cases/GetRecordService'
import { InMemoryRecordRepository } from '@/contexts/data/adapters/out/persistence/InMemoryRecordRepository'
import { InMemoryRecordStore } from '@/contexts/data/adapters/out/persistence/InMemoryRecordStore'
import { InMemoryEntityRepository } from '@/contexts/data/adapters/out/persistence/InMemoryEntityRepository'
import { InsertRecordService } from '@/contexts/data/application/use-cases/InsertRecordService'
import { CreateEntityService } from '@/contexts/data/application/use-cases/CreateEntityService'
import { SystemClock } from '@/platform/runtime/SystemClock'

const noopEvents = { publish: async () => {} }

describe('GetRecordService', () => {
  it('returns the record data and version, null when missing', async () => {
    const clock = new SystemClock()
    const entities = new InMemoryEntityRepository()
    const records = new InMemoryRecordRepository(new InMemoryRecordStore())
    const createEntity = new CreateEntityService(entities, noopEvents, clock)
    const insert = new InsertRecordService(entities, records, noopEvents, clock)
    const get = new GetRecordService(records)

    const ent = await createEntity.execute({ name: 'Widgets', fields: [{ name: 'nome', required: false, type: { kind: 'text' } }] })
    if (!ent.ok) throw new Error(ent.error)
    const ins = await insert.execute({ entityId: ent.value.id, data: { nome: 'a' } })
    if (!ins.ok) throw new Error(ins.error)

    const found = await get.execute({ recordId: ins.value.id })
    expect(found).toEqual({ id: ins.value.id, data: { nome: 'a' }, version: ins.value.version })
    expect(await get.execute({ recordId: 'nope' })).toBeNull()
  })
})
