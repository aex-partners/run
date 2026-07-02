import { describe, it, expect } from 'vitest'
import {
  serializeValue,
  parseValue,
  SETUP_COMPLETE_KEY,
  SETUP_COMPLETE_VALUE,
} from '@/contexts/settings/domain/Setting'

describe('serializeValue', () => {
  it('passes strings through verbatim', () => {
    expect(serializeValue('hello')).toBe('hello')
  })

  it('JSON-encodes non-strings', () => {
    expect(serializeValue(42)).toBe('42')
    expect(serializeValue(true)).toBe('true')
    expect(serializeValue(['a', 'b'])).toBe('["a","b"]')
    expect(serializeValue({ a: 1 })).toBe('{"a":1}')
  })
})

describe('parseValue', () => {
  it('parses JSON when possible', () => {
    expect(parseValue('42')).toBe(42)
    expect(parseValue('true')).toBe(true)
    expect(parseValue('["a","b"]')).toEqual(['a', 'b'])
    expect(parseValue('{"a":1}')).toEqual({ a: 1 })
  })

  it('falls back to the raw string for non-JSON', () => {
    expect(parseValue('America/Sao_Paulo')).toBe('America/Sao_Paulo')
    expect(parseValue('not json')).toBe('not json')
  })

  it('round-trips a string value', () => {
    expect(parseValue(serializeValue('plain text'))).toBe('plain text')
  })

  it('round-trips a structured value', () => {
    const v = { name: 'Acme', tags: ['x', 'y'] }
    expect(parseValue(serializeValue(v))).toEqual(v)
  })
})

describe('setup sentinel', () => {
  it('exposes the one-time setup key/value', () => {
    expect(SETUP_COMPLETE_KEY).toBe('system.setupComplete')
    expect(SETUP_COMPLETE_VALUE).toBe('true')
  })
})
