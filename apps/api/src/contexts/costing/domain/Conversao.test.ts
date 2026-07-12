import { describe, it, expect } from 'vitest'
import {
  resolveTempo, taxasVigentes, pickTaxa, computeConversao, totalizarCusto,
  OperacaoInput, TaxaRow,
} from '@/contexts/costing/domain/Conversao'

const op = (over: Partial<OperacaoInput> = {}): OperacaoInput => ({
  id: 'o1', seq: 10, centroId: 'C1', tempoPadraoMin: 10, tempoPorTamanho: {},
  tempoSetupMin: 0, loteSetup: 1, ...over,
})

describe('resolveTempo', () => {
  it('uses the per-size cell when present', () => {
    expect(resolveTempo(op({ tempoPorTamanho: { T36: 8 } }), [{ id: 'T36', fatorQtd: null }])).toBe(8)
  })
  it('falls back to tempoPadraoMin', () => {
    expect(resolveTempo(op(), [{ id: 'T38', fatorQtd: null }])).toBe(10)
  })
  it('amortizes setup over the batch', () => {
    expect(resolveTempo(op({ tempoSetupMin: 20, loteSetup: 10 }), [])).toBe(12)   // 10 + 20/10
  })
  it('guards loteSetup <= 0 (treats it as 1)', () => {
    expect(resolveTempo(op({ tempoSetupMin: 5, loteSetup: 0 }), [])).toBe(15)
  })
})

describe('taxasVigentes / pickTaxa', () => {
  const row = (over: Partial<TaxaRow>): TaxaRow => ({
    chave: 'taxa_fixa_min', centroId: null, valor: 0.4, vigenciaInicio: '2026-01-01', vigenciaFim: null, ...over,
  })
  it('drops rates that have not started or already ended', () => {
    const t = taxasVigentes([
      row({ valor: 1, vigenciaInicio: '2027-01-01' }),                        // futura
      row({ valor: 2, vigenciaInicio: '2025-01-01', vigenciaFim: '2025-12-31' }), // encerrada
      row({ valor: 3 }),                                                       // vigente, aberta
    ], '2026-07-10')
    expect(t.map((x) => x.valor)).toEqual([3])
  })
  it('the latest vigenciaInicio wins for the same key+scope', () => {
    const t = taxasVigentes([
      row({ valor: 1, vigenciaInicio: '2026-01-01' }),
      row({ valor: 9, vigenciaInicio: '2026-06-01' }),
    ], '2026-07-10')
    expect(t.map((x) => x.valor)).toEqual([9])
  })
  it('a work-center rate beats the global one', () => {
    const t = taxasVigentes([row({ valor: 1 }), row({ valor: 7, centroId: 'C1' })], '2026-07-10')
    expect(pickTaxa(t, 'taxa_fixa_min', 'C1')).toBe(7)
    expect(pickTaxa(t, 'taxa_fixa_min', 'C2')).toBe(1)
    expect(pickTaxa(t, 'taxa_moi_min', 'C1')).toBe(0)   // inexistente -> 0
  })

  // CONTRATO DE ORDEM: `rows` chega NEWEST-FIRST (o engine devolve ORDER BY created_at DESC).
  // O desempate usa `>` estrito, então num empate EXATO (mesma chave, mesmo escopo, mesma
  // vigenciaInicio) vence a PRIMEIRA linha — a mais nova. É o que faz "defini a taxa errada,
  // defino de novo a partir da mesma data" (o único fluxo de correção, já que DefinirTaxaCusto
  // só insere) corrigir de fato o custo em vez de manter a linha velha.
  it('on an EXACT tie the FIRST row wins — and rows arrive newest-first, so the correction wins', () => {
    const t = taxasVigentes([
      row({ valor: 0.99, vigenciaInicio: '2026-01-01' }),   // inserida DEPOIS: chega primeiro
      row({ valor: 0.10, vigenciaInicio: '2026-01-01' }),   // a linha velha, errada
    ], '2026-07-10')
    expect(t.map((x) => x.valor)).toEqual([0.99])
  })
})

describe('computeConversao — GOLDEN: reproduz a FT 01 (Casimira) da planilha real', () => {
  it('bate os R$ 64,62 de custo unitário', () => {
    const conv = computeConversao({
      operacoes: [op({ tempoPadraoMin: 45.53 })],
      centros: { C1: { id: 'C1', custoMinMod: 0.28054714772727274 } },
      taxas: [
        { chave: 'taxa_fixa_min', centroId: null, valor: 0.41032981150793657 },
        { chave: 'taxa_moi_min', centroId: null, valor: 0.032312824675324675 },
      ],
      skuVariacoes: [],
    })
    expect(conv.tempoTotalMin).toBeCloseTo(45.53, 6)
    expect(conv.custoMod).toBeCloseTo(12.773311636022727, 6)       // MOD da planilha
    expect(conv.custoIndireto).toBeCloseTo(20.153519225423885, 6)  // Fixas 18,68 + MOI 1,47
    expect(conv.erros).toEqual([])

    const total = totalizarCusto(31.69148611111111, conv)          // materiais da planilha
    expect(total.total).toBeCloseTo(64.61831697255772, 6)          // <<< custo unitário da FT 01
  })
})

describe('computeConversao — bordas', () => {
  it('operação sem centro: conta o TEMPO, MOD 0, erro explícito', () => {
    const conv = computeConversao({
      operacoes: [op({ centroId: null, tempoPadraoMin: 20 })],
      centros: {}, taxas: [{ chave: 'taxa_fixa_min', centroId: null, valor: 0.5 }], skuVariacoes: [],
    })
    expect(conv.tempoTotalMin).toBe(20)
    expect(conv.custoMod).toBe(0)
    expect(conv.custoIndireto).toBe(10)          // rateio ainda ocorre pelo tempo
    expect(conv.operacoes[0].semCentro).toBe(true)
    expect(conv.erros.length).toBe(1)
  })
  it('centro sem custo por minuto: MOD 0 + erro', () => {
    const conv = computeConversao({
      operacoes: [op()], centros: { C1: { id: 'C1', custoMinMod: null } }, taxas: [], skuVariacoes: [],
    })
    expect(conv.custoMod).toBe(0)
    expect(conv.erros.length).toBe(1)
  })
  it('sem operações: conversão zerada, sem erro', () => {
    const conv = computeConversao({ operacoes: [], centros: {}, taxas: [], skuVariacoes: [] })
    expect(conv).toMatchObject({ tempoTotalMin: 0, custoMod: 0, custoIndireto: 0, custoConversao: 0, erros: [] })
  })
})
