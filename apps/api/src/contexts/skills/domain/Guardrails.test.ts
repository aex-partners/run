import { describe, it, expect } from 'vitest'
import { Guardrails } from '@/contexts/skills/domain/Guardrails'

describe('Guardrails.empty', () => {
  it('has all fields undefined', () => {
    const g = Guardrails.empty()
    expect(g.maxSteps).toBeUndefined()
    expect(g.blockedTools).toBeUndefined()
    expect(g.requireConfirmation).toBeUndefined()
  })
})

describe('Guardrails.of (validating)', () => {
  it('accepts a valid envelope', () => {
    const r = Guardrails.of({ maxSteps: 5, blockedTools: ['send_email'], requireConfirmation: true })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.maxSteps).toBe(5)
    expect(r.value.blockedTools).toEqual(['send_email'])
    expect(r.value.requireConfirmation).toBe(true)
  })

  it('trims and dedupes blocked tools (order preserved)', () => {
    const r = Guardrails.of({ blockedTools: ['a', ' a ', 'b'] })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.blockedTools).toEqual(['a', 'b'])
  })

  it('rejects a non-positive or non-integer maxSteps', () => {
    expect(Guardrails.of({ maxSteps: 0 }).ok).toBe(false)
    expect(Guardrails.of({ maxSteps: -1 }).ok).toBe(false)
    expect(Guardrails.of({ maxSteps: 1.5 }).ok).toBe(false)
  })

  it('rejects an empty blocked-tool entry', () => {
    const r = Guardrails.of({ blockedTools: ['ok', '   '] })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('non-empty')
  })

  it('leaves omitted fields undefined', () => {
    const r = Guardrails.of({ requireConfirmation: false })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.maxSteps).toBeUndefined()
    expect(r.value.blockedTools).toBeUndefined()
    expect(r.value.requireConfirmation).toBe(false)
  })
})

describe('Guardrails.fromJSON (trusting)', () => {
  it('reads known keys', () => {
    const g = Guardrails.fromJSON({ maxSteps: 3, blockedTools: ['x'], requireConfirmation: true })
    expect(g.maxSteps).toBe(3)
    expect(g.blockedTools).toEqual(['x'])
    expect(g.requireConfirmation).toBe(true)
  })

  it('ignores invalid stored values without throwing', () => {
    const g = Guardrails.fromJSON({ maxSteps: 0, blockedTools: 'not-an-array', requireConfirmation: 'yes' })
    expect(g.maxSteps).toBeUndefined()
    expect(g.blockedTools).toBeUndefined()
    expect(g.requireConfirmation).toBeUndefined()
  })

  it('filters non-string / blank entries out of blockedTools', () => {
    const g = Guardrails.fromJSON({ blockedTools: ['a', '', 'a', 'b'] })
    expect(g.blockedTools).toEqual(['a', 'b'])
  })
})

describe('Guardrails projections', () => {
  it('toValue and toJSON round-trip a populated VO', () => {
    const r = Guardrails.of({ maxSteps: 2, blockedTools: ['t'], requireConfirmation: false })
    if (!r.ok) throw new Error(r.error)
    expect(r.value.toValue()).toEqual({ maxSteps: 2, blockedTools: ['t'], requireConfirmation: false })
    expect(r.value.toJSON()).toEqual({ maxSteps: 2, blockedTools: ['t'], requireConfirmation: false })
  })

  it('omits undefined fields from the projections', () => {
    expect(Guardrails.empty().toValue()).toEqual({})
    expect(Guardrails.empty().toJSON()).toEqual({})
  })
})
