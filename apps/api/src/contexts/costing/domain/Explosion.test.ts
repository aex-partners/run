import { describe, it, expect } from 'vitest'
import { resolveQuantidade, resolveItem, explodeFicha } from '@/contexts/costing/domain/Explosion'

const line = (over = {}) => ({ itemId: 'i', isFantasma: false, unidade: 'm2', qtyBase: 1.4, qtyPorTamanho: {}, ...over })

describe('resolveQuantidade', () => {
  it('uses the explicit cell when present for a sku size', () => {
    const l = line({ qtyPorTamanho: { T36: 1.2, T40: 1.6 } })
    expect(resolveQuantidade(l, [{ id: 'T36', fatorQtd: 85 }])).toBe(1.2)
  })
  it('falls back to base times factor when no explicit cell', () => {
    expect(resolveQuantidade(line(), [{ id: 'T36', fatorQtd: 50 }])).toBeCloseTo(0.7, 6)
  })
  it('falls back to base when neither cell nor factor', () => {
    expect(resolveQuantidade(line(), [{ id: 'T38', fatorQtd: null }])).toBe(1.4)
  })
  it('cell wins over factor', () => {
    const l = line({ qtyPorTamanho: { T38: 2.0 } })
    expect(resolveQuantidade(l, [{ id: 'T38', fatorQtd: 200 }])).toBe(2.0)
  })
})

describe('resolveItem', () => {
  const subs = [{ variacaoId: 'CAQUI', deItemId: 'PH', paraItemId: 'SARJA_CAQUI' }]
  it('non-phantom returns itself, resolved', () => {
    expect(resolveItem(line({ itemId: 'BTN', isFantasma: false }), ['CAQUI'], subs)).toEqual({ itemId: 'BTN', resolved: true })
  })
  it('phantom with a matching sku variation is substituted', () => {
    expect(resolveItem(line({ itemId: 'PH', isFantasma: true }), ['CAQUI'], subs)).toEqual({ itemId: 'SARJA_CAQUI', resolved: true })
  })
  it('phantom without matching sub is unresolved', () => {
    expect(resolveItem(line({ itemId: 'PH', isFantasma: true }), ['AZUL'], subs)).toEqual({ itemId: 'PH', resolved: false })
  })
})

describe('explodeFicha', () => {
  it('resolves qty + item + cost and sums the total', () => {
    const res = explodeFicha({
      lines: [
        { itemId: 'PH', isFantasma: true, unidade: 'm2', qtyBase: 1.4, qtyPorTamanho: { T38: 1.4 } },
        { itemId: 'BTN', isFantasma: false, unidade: 'un', qtyBase: 2, qtyPorTamanho: {} },
      ],
      skuVariacoes: [{ id: 'T38', fatorQtd: 100 }, { id: 'CAQUI', fatorQtd: null }],
      substituicoes: [{ variacaoId: 'CAQUI', deItemId: 'PH', paraItemId: 'SARJA_CAQUI' }],
      custos: { SARJA_CAQUI: 20, BTN: 0.3 },
    })
    expect(res.erros).toEqual([])
    expect(res.custoTotal).toBeCloseTo(1.4 * 20 + 2 * 0.3, 6)
    expect(res.lines[0]).toMatchObject({ itemIdResolvido: 'SARJA_CAQUI', qty: 1.4, custoUnit: 20, custoTotal: 28 })
  })
  it('flags an unresolved phantom and a missing cost, without throwing', () => {
    const res = explodeFicha({
      lines: [{ itemId: 'PH', isFantasma: true, unidade: 'm2', qtyBase: 1, qtyPorTamanho: {} }],
      skuVariacoes: [{ id: 'AZUL', fatorQtd: null }],
      substituicoes: [],
      custos: {},
    })
    expect(res.lines[0].naoResolvido).toBe(true)
    expect(res.erros.length).toBe(1)
  })
})
