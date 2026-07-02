import { describe, it, expect } from 'vitest'
import { InMemoryListRecords } from '@/contexts/data/adapters/out/persistence/InMemoryListRecords'
import { InMemoryRecordStore } from '@/contexts/data/adapters/out/persistence/InMemoryRecordStore'
import { RecordRow } from '@/contexts/data/application/mappers/RecordMapper'

const row = (id: string, entityId: string, data: RecordRow['data']): RecordRow => ({
  id,
  entityId,
  data,
  version: 0,
  createdBy: null,
})

describe('InMemoryListRecords (read-side query)', () => {
  it('returns only the rows of the requested entity, as RecordViews', async () => {
    const store = new InMemoryRecordStore()
    store.rows.set('r1', row('r1', 'ent-1', { name: 'Acme' }))
    store.rows.set('r2', row('r2', 'ent-2', { name: 'Other' }))
    store.rows.set('r3', row('r3', 'ent-1', { name: 'Beta' }))
    const query = new InMemoryListRecords(store)

    const views = await query.execute({ entityId: 'ent-1' })
    expect(views.map((v) => v.id).sort()).toEqual(['r1', 'r3'])
    expect(views[0]).toMatchObject({ version: 0, data: expect.any(Object) })
  })

  it('sorts by the requested field with locale-aware string comparison', async () => {
    const store = new InMemoryRecordStore()
    store.rows.set('r1', row('r1', 'ent-1', { name: 'Charlie' }))
    store.rows.set('r2', row('r2', 'ent-1', { name: 'alpha' }))
    store.rows.set('r3', row('r3', 'ent-1', { name: 'Bravo' }))
    const query = new InMemoryListRecords(store)

    const views = await query.execute({ entityId: 'ent-1', sortBy: 'name' })
    expect(views.map((v) => v.data.name)).toEqual(['alpha', 'Bravo', 'Charlie'])
  })

  it('returns an empty list for an entity with no rows', async () => {
    const query = new InMemoryListRecords(new InMemoryRecordStore())
    expect(await query.execute({ entityId: 'ent-x' })).toEqual([])
  })
})
