import { describe, it, expect } from 'vitest'
import { custearPreco, Componentes } from '@/contexts/precificacao/domain/Marcacao'

const c = (over: Partial<Componentes> = {}): Componentes => ({
  imposto: 0, iss: 0, comissao: 0, despFinanceira: 0, frete: 0, lucro: 0, ...over,
})

describe('custearPreco', () => {
  // O GOLDEN, direto da planilha: Casimira 01, lojista à vista, lucro 0%.
  it('reproduz a planilha: R$ 64,62 / (1 − 0,1333) = R$ 74,56', () => {
    const r = custearPreco(64.618316972557722, c({ imposto: 0.0333, comissao: 0.10 }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.pv).toBeCloseTo(74.556728940299664, 6)   // valor exato da célula
  })

  it('condição a prazo (desp financeira 2%) sobe o preço', () => {
    const aVista = custearPreco(100, c({ imposto: 0.0333, comissao: 0.10 }))
    const prazo = custearPreco(100, c({ imposto: 0.0333, comissao: 0.10, despFinanceira: 0.02 }))
    expect(aVista.ok && prazo.ok && prazo.value.pv > aVista.value.pv).toBe(true)
  })

  it('lucro maior sobe o preço', () => {
    const l0 = custearPreco(100, c({ imposto: 0.0333, comissao: 0.10 }))
    const l10 = custearPreco(100, c({ imposto: 0.0333, comissao: 0.10, lucro: 0.10 }))
    expect(l0.ok && l10.ok && l10.value.pv > l0.value.pv).toBe(true)
  })

  it('o markup é 1/(1−Σ%) e o pv é custo×markup', () => {
    const r = custearPreco(50, c({ imposto: 0.0333, comissao: 0.10, lucro: 0.05 }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.deducao).toBeCloseTo(0.1833, 10)
    expect(r.value.markup).toBeCloseTo(1 / 0.8167, 10)
    expect(r.value.pv).toBeCloseTo(50 / 0.8167, 10)
  })

  // A BORDA: deduções >= 100% não têm preço. A planilha cuspia negativo.
  it('Σ% = 100% é erro duro', () => {
    const r = custearPreco(100, c({ lucro: 1 }))
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('100%')
  })

  it('Σ% > 100% é erro duro (nunca um pv negativo)', () => {
    const r = custearPreco(100, c({ imposto: 0.0333, comissao: 0.10, lucro: 0.95 }))
    expect(r.ok).toBe(false)
  })

  it('custo <= 0 é erro (SKU sem custo real não precifica)', () => {
    expect(custearPreco(0, c({ imposto: 0.0333 })).ok).toBe(false)
    expect(custearPreco(-5, c({ imposto: 0.0333 })).ok).toBe(false)
  })

  // Componente não-finito não pode virar um preço silencioso.
  it('componente não-finito é erro duro', () => {
    expect(custearPreco(100, c({ lucro: NaN })).ok).toBe(false)
    expect(custearPreco(100, c({ comissao: Infinity })).ok).toBe(false)
    expect(custearPreco(NaN, c()).ok).toBe(false)
  })
})
