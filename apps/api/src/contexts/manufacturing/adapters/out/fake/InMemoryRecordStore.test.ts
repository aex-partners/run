import { describe, it, expect } from 'vitest'
import { InMemoryRecordStore } from '@/contexts/manufacturing/adapters/out/fake/InMemoryRecordStore'

describe('InMemoryRecordStore (manufacturing)', () => {
  it('inserts, gets, and queries by a real data field', async () => {
    const s = new InMemoryRecordStore()
    s.seedEntity('operacoes', 'O')
    const id = await s.insert('O', { nome: 'COSTURA', modelo: 'M1' })
    expect((await s.get(id))?.data.nome).toBe('COSTURA')
    expect((await s.query('O', [{ field: 'modelo', op: 'eq', value: 'M1' }])).length).toBe(1)
    expect(await s.entityIdBySlug('operacoes')).toBe('O')
  })

  it('REJECTS a query by field "id" (mirrors the real query engine)', async () => {
    const s = new InMemoryRecordStore()
    s.seedEntity('x', 'X')
    const id = await s.insert('X', { n: 1 })
    await expect(s.query('X', [{ field: 'id', op: 'in', values: [id] }])).rejects.toThrow()
  })

  it('update bumps version and rejects a stale expectedVersion; delete removes', async () => {
    const s = new InMemoryRecordStore()
    s.seedEntity('x', 'X')
    const id = await s.insert('X', { n: 1 })
    await s.update(id, { n: 2 }, 1)
    expect((await s.get(id))?.version).toBe(2)
    await expect(s.update(id, { n: 3 }, 1)).rejects.toThrow()
    await s.delete(id)
    expect(await s.get(id)).toBeNull()
  })
})
