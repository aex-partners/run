import { describe, it, expect } from 'vitest'
import { normalizeQuery, pointFromCache } from '@/contexts/geocode/domain/geocode'

describe('normalizeQuery (cache key)', () => {
  it('trims, collapses internal whitespace, and lowercases', () => {
    expect(normalizeQuery('  123   Main   St  ')).toBe('123 main st')
  })

  it('maps equivalent queries to the same key', () => {
    expect(normalizeQuery('Rua Augusta, 100')).toBe(normalizeQuery('  rua   augusta,   100 '))
  })

  it('returns an empty string for a blank query', () => {
    expect(normalizeQuery('   ')).toBe('')
  })
})

describe('pointFromCache (miss rule)', () => {
  it('reads stored coords back into a point', () => {
    expect(pointFromCache({ lat: -23.5, lng: -46.6 })).toEqual({ lat: -23.5, lng: -46.6 })
  })

  it('returns null for a recorded miss (null coords)', () => {
    expect(pointFromCache({ lat: null, lng: null })).toBeNull()
    expect(pointFromCache({ lat: -23.5, lng: null })).toBeNull()
    expect(pointFromCache({ lat: null, lng: -46.6 })).toBeNull()
  })

  it('treats 0/0 as a valid resolved point, not a miss', () => {
    expect(pointFromCache({ lat: 0, lng: 0 })).toEqual({ lat: 0, lng: 0 })
  })
})
