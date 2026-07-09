import { describe, it, expect } from 'vitest'
import { InMemoryRecordStore } from '@/contexts/costing/adapters/out/fake/InMemoryRecordStore'

describe('InMemoryRecordStore', () => {
  it('inserts, gets, queries by eq and in', async () => {
    const s = new InMemoryRecordStore()
    s.seedEntity('produtos', 'P')
    const id = await s.insert('P', { nome: 'A', preco_custo: 5 })
    expect((await s.get(id))?.data.nome).toBe('A')
    expect((await s.query('P', [{ field: 'nome', op: 'eq', value: 'A' }])).length).toBe(1)
    expect((await s.query('P', [{ field: 'nome', op: 'in', values: ['A'] }])).length).toBe(1)
    // querying by 'id' is unsupported here too, mirroring the real query engine (resolveFieldRef has no record-id field)
    await expect(s.query('P', [{ field: 'id', op: 'in', values: [id] }])).rejects.toThrow()
    expect(await s.entityIdBySlug('produtos')).toBe('P')
  })
  it('update bumps version and rejects stale expectedVersion', async () => {
    const s = new InMemoryRecordStore()
    s.seedEntity('x', 'X')
    const id = await s.insert('X', { n: 1 })
    await s.update(id, { n: 2 }, 1)
    expect((await s.get(id))?.version).toBe(2)
    await expect(s.update(id, { n: 3 }, 1)).rejects.toThrow()
  })
})
