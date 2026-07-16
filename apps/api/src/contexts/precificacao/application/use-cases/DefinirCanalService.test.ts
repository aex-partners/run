import { describe, it, expect } from 'vitest'
import { testWorld, E } from '@/contexts/precificacao/adapters/out/fake/testWorld'
import { DefinirCanalService } from '@/contexts/precificacao/application/use-cases/DefinirCanalService'

describe('DefinirCanalService', () => {
  it('cria um canal novo', async () => {
    const { store } = testWorld()
    const r = await new DefinirCanalService(store, store).execute({ nome: 'atacado', comissao: 0.05 })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const c = (await store.get(r.value.id))!.data
    expect(c.nome).toBe('atacado'); expect(c.comissao).toBe(0.05); expect(c.ativo).toBe(true)
  })

  it('atualiza um canal existente sem apagar o resto', async () => {
    const { store } = testWorld()
    const r = await new DefinirCanalService(store, store).execute({ id: 'LOJISTA', nome: 'lojista', comissao: 0.12 })
    expect(r.ok).toBe(true)
    expect((await store.get('LOJISTA'))!.data.comissao).toBe(0.12)
  })

  // percent é fração: 12 no lugar de 0,12 é erro (senão vira 1200% e a marcação estoura).
  it('comissão fora da faixa [0,1] é recusada', async () => {
    const { store } = testWorld()
    const r = await new DefinirCanalService(store, store).execute({ nome: 'x', comissao: 12 })
    expect(r.ok).toBe(false)
    expect(!r.ok && r.error).toContain('FRAÇÃO')
  })
})
