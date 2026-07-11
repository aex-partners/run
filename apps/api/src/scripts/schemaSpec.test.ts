import { describe, it, expect } from 'vitest'
import { fieldConfig, FieldSpec } from '@/scripts/schemaSpec'

const f = (over: Partial<FieldSpec>): FieldSpec => ({ slug: 's', displayName: 'S', kind: 'text', ...over })

describe('fieldConfig', () => {
  it('maps duration', () => {
    expect(fieldConfig(f({ kind: 'duration' }), () => null)).toEqual({ kind: 'duration' })
  })
  it('maps currency with BRL and no decimalPlaces by default', () => {
    expect(fieldConfig(f({ kind: 'currency' }), () => null)).toEqual({ kind: 'currency', currencyCode: 'BRL' })
  })
  it('maps currency with decimalPlaces when given', () => {
    expect(fieldConfig(f({ kind: 'currency', decimalPlaces: 4 }), () => null))
      .toEqual({ kind: 'currency', currencyCode: 'BRL', decimalPlaces: 4 })
  })
  it('maps relation to the resolved target entity id', () => {
    expect(fieldConfig(f({ kind: 'relation', targetSlug: 'produtos' }), (s) => (s === 'produtos' ? 'P' : null)))
      .toEqual({ kind: 'relation', targetEntityId: 'P' })
  })
  it('throws when a relation target does not exist', () => {
    expect(() => fieldConfig(f({ kind: 'relation', targetSlug: 'nada' }), () => null)).toThrow()
  })
  it('throws on an unknown kind', () => {
    expect(() => fieldConfig(f({ kind: 'bogus' }), () => null)).toThrow()
  })
})
