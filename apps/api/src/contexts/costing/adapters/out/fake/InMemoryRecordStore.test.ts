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
  // Espelha as DUAS metades do engine real: `ORDER BY created_at DESC` + `LIMIT min(n, 500)`.
  // A ORDEM não é cosmética: `taxasVigentes` desempata pela POSIÇÃO (num empate exato vence a
  // primeira linha = a mais nova). Um fake em ordem de inserção faria a taxa ERRADA vencer nos
  // testes e a certa em produção.
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
  it('update bumps version and rejects stale expectedVersion', async () => {
    const s = new InMemoryRecordStore()
    s.seedEntity('x', 'X')
    const id = await s.insert('X', { n: 1 })
    await s.update(id, { n: 2 }, 1)
    expect((await s.get(id))?.version).toBe(2)
    await expect(s.update(id, { n: 3 }, 1)).rejects.toThrow()
  })
})
