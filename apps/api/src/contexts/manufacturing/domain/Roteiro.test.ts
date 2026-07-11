import { describe, it, expect } from 'vitest'
import { selecionarRoteiroPublicado, proximaRev, OperacaoRow } from '@/contexts/manufacturing/domain/Roteiro'

const op = (over: Partial<OperacaoRow>): OperacaoRow => ({
  id: 'o', seq: 10, nome: 'COSTURA', centroId: 'C1', tempoPadraoMin: 10, tempoPorTamanho: {},
  tempoSetupMin: 0, loteSetup: 1, agregada: true, rev: 1, status: 'publicada', ...over,
})

describe('selecionarRoteiroPublicado', () => {
  it('returns null when there is no published row', () => {
    expect(selecionarRoteiroPublicado('M1', [op({ status: 'rascunho' })])).toBeNull()
  })
  it('picks the max published rev and ignores drafts with a higher rev', () => {
    const r = selecionarRoteiroPublicado('M1', [
      op({ id: 'a', rev: 1 }), op({ id: 'b', rev: 2 }), op({ id: 'c', rev: 9, status: 'rascunho' }),
    ])
    expect(r?.rev).toBe(2)
    expect(r?.operacoes.map((o) => o.id)).toEqual(['b'])
  })
  it('orders the selected rev by seq ascending', () => {
    const r = selecionarRoteiroPublicado('M1', [
      op({ id: 'x', seq: 30, rev: 2 }), op({ id: 'y', seq: 10, rev: 2 }), op({ id: 'z', seq: 20, rev: 2 }),
    ])
    expect(r?.operacoes.map((o) => o.id)).toEqual(['y', 'z', 'x'])
  })
})

describe('proximaRev', () => {
  it('is 1 when nothing was ever published', () => {
    expect(proximaRev([op({ status: 'rascunho' })])).toBe(1)
  })
  it('is maxPublicada + 1', () => {
    expect(proximaRev([op({ rev: 1 }), op({ rev: 3 }), op({ rev: 9, status: 'rascunho' })])).toBe(4)
  })
})
