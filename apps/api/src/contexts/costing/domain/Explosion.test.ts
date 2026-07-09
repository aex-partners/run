import { describe, it, expect } from 'vitest'
import { resolveQuantidade } from '@/contexts/costing/domain/Explosion'

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
