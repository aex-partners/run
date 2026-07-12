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

  // Espelha as DUAS metades do engine real: `ORDER BY created_at DESC` + `LIMIT min(n, 500)`.
  it('MIRRORS the real engine: returns NEWEST-FIRST, caps at 50 by default (dropping the OLDEST), hard-caps at 500', async () => {
    const s = new InMemoryRecordStore()
    s.seedEntity('x', 'X')
    for (let i = 0; i < 60; i++) await s.insert('X', { n: i })

    const padrao = await s.query('X', [])                    // sem limite: engine corta em 50
    expect(padrao).toHaveLength(50)
    // created_at DESC: a linha 59 (mais NOVA) vem primeiro; as 10 mais VELHAS (0..9) somem
    expect(padrao.map((r) => r.data.n)).toEqual([...Array(50).keys()].map((i) => 59 - i))

    const tudo = await s.query('X', [], 500)                 // limite explícito: tudo volta
    expect(tudo).toHaveLength(60)
    expect(tudo[0]!.data.n).toBe(59)                         // ...ainda NEWEST-FIRST
    expect(tudo.at(-1)!.data.n).toBe(0)
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
