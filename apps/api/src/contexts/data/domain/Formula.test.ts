import { describe, it, expect } from 'vitest'
import { Formula } from '@/contexts/data/domain/Formula'
import { FormulaEvaluator } from '@/contexts/data/domain/FormulaEvaluator'

describe('Formula', () => {
  it('parses and evaluates arithmetic with precedence', () => {
    const f = Formula.parse('price * qty + 5', ['price', 'qty'])
    expect(f.ok).toBe(true)
    if (!f.ok) return
    const r = FormulaEvaluator.evaluate(f.value, { price: 10, qty: 3 })
    expect(r.ok && r.value).toBe(35)
  })

  it('respects parentheses', () => {
    const f = Formula.parse('(a + b) * 2', ['a', 'b'])
    expect(f.ok).toBe(true)
    if (!f.ok) return
    const r = FormulaEvaluator.evaluate(f.value, { a: 4, b: 1 })
    expect(r.ok && r.value).toBe(10)
  })

  it('rejects a reference to an unknown field', () => {
    const f = Formula.parse('price * missing', ['price'])
    expect(f.ok).toBe(false)
  })

  it('fails evaluation on division by zero', () => {
    const f = Formula.parse('a / b', ['a', 'b'])
    expect(f.ok).toBe(true)
    if (!f.ok) return
    const r = FormulaEvaluator.evaluate(f.value, { a: 1, b: 0 })
    expect(r.ok).toBe(false)
  })
})
