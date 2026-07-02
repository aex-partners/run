import { describe, it, expect } from 'vitest'
import { relRef, isRelRef } from '@/contexts/bling/domain/mirror/MappedRecord'

describe('relRef', () => {
  it('builds a marker, stringifies the id', () => {
    expect(relRef('bling_produtos', 42)).toEqual({ __rel: true, slug: 'bling_produtos', externalId: '42' })
  })
  it('returns null for empty/zero ids', () => {
    expect(relRef('x', 0)).toBeNull()
    expect(relRef('x', '0')).toBeNull()
    expect(relRef('x', null)).toBeNull()
    expect(relRef('x', undefined)).toBeNull()
  })
  it('isRelRef narrows', () => {
    expect(isRelRef(relRef('x', 1))).toBe(true)
    expect(isRelRef('nope')).toBe(false)
    expect(isRelRef(null)).toBe(false)
  })
})
