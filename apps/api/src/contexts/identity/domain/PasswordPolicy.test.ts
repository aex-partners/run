import { describe, it, expect } from 'vitest'
import {
  PasswordPolicy,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
} from '@/contexts/identity/domain/PasswordPolicy'

// A baseline password that satisfies every class so each failure test can drop
// exactly one requirement.
const VALID = 'Abcdef1!ghij' // 12 chars: lower, upper, digit, special

describe('PasswordPolicy.validateComplexity', () => {
  it('accepts a password that meets length and all four character classes', () => {
    const r = PasswordPolicy.validateComplexity(VALID)
    expect(r.ok).toBe(true)
  })

  it('accepts the minimum allowed length exactly', () => {
    const pw = 'Abcdefg1!xyz' // exactly 12
    expect(pw.length).toBe(MIN_PASSWORD_LENGTH)
    expect(PasswordPolicy.validateComplexity(pw).ok).toBe(true)
  })

  it('accepts the maximum allowed length exactly', () => {
    // 128 chars, all classes present.
    const pw = 'Aa1!' + 'b'.repeat(MAX_PASSWORD_LENGTH - 4)
    expect(pw.length).toBe(MAX_PASSWORD_LENGTH)
    expect(PasswordPolicy.validateComplexity(pw).ok).toBe(true)
  })

  it('rejects a password shorter than the minimum', () => {
    const r = PasswordPolicy.validateComplexity('Ab1!cdef') // 8 chars
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`)
  })

  it('rejects an empty string with the length message', () => {
    const r = PasswordPolicy.validateComplexity('')
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('at least')
  })

  it('rejects a password longer than the maximum', () => {
    const pw = 'Aa1!' + 'b'.repeat(MAX_PASSWORD_LENGTH - 3) // 129 chars
    expect(pw.length).toBe(MAX_PASSWORD_LENGTH + 1)
    const r = PasswordPolicy.validateComplexity(pw)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe(`Password must be at most ${MAX_PASSWORD_LENGTH} characters long.`)
  })

  it('rejects a password missing a lowercase letter', () => {
    const r = PasswordPolicy.validateComplexity('ABCDEF1!GHIJ')
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('Password must contain a lowercase letter.')
  })

  it('rejects a password missing an uppercase letter', () => {
    const r = PasswordPolicy.validateComplexity('abcdef1!ghij')
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('Password must contain an uppercase letter.')
  })

  it('rejects a password missing a digit', () => {
    const r = PasswordPolicy.validateComplexity('Abcdefg!hijk')
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('Password must contain a digit.')
  })

  it('rejects a password missing a special character', () => {
    const r = PasswordPolicy.validateComplexity('Abcdefg1hijk')
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('Password must contain a special character.')
  })

  it('checks length before character classes (length wins on a short all-lowercase input)', () => {
    const r = PasswordPolicy.validateComplexity('abc')
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('at least')
  })
})
