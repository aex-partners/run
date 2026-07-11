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

  it('MIRRORS the real engine cap: defaults to 50 rows and drops the OLDEST; hard-caps at 500', async () => {
    const s = new InMemoryRecordStore()
    s.seedEntity('x', 'X')
    for (let i = 0; i < 60; i++) await s.insert('X', { n: i })

    const padrao = await s.query('X', [])                    // sem limite: engine corta em 50
    expect(padrao).toHaveLength(50)
    expect(padrao.map((r) => r.data.n)).toEqual([...Array(50).keys()].map((i) => i + 10))  // as 10 mais VELHAS somem

    expect(await s.query('X', [], 500)).toHaveLength(60)     // limite explícito: tudo volta
    expect(await s.query('X', [], 9999)).toHaveLength(60)    // teto HARD de 500 não estoura
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
