import { describe, it, expect } from 'vitest'
import { reconstructThreadId } from '@/contexts/email/domain/ThreadReconstruction'

describe('reconstructThreadId', () => {
  it('prefers In-Reply-To when present', () => {
    expect(reconstructThreadId({ inReplyTo: '<parent@host>', references: ['<a>', '<b>'] })).toBe('<parent@host>')
  })

  it('falls back to the last References entry when In-Reply-To is absent', () => {
    expect(reconstructThreadId({ inReplyTo: null, references: ['<a>', '<b>', '<c>'] })).toBe('<c>')
  })

  it('skips blank trailing references to find the nearest non-empty ancestor', () => {
    expect(reconstructThreadId({ references: ['<a>', '   ', ''] })).toBe('<a>')
  })

  it('returns null for a root message (no headers)', () => {
    expect(reconstructThreadId({})).toBeNull()
    expect(reconstructThreadId({ inReplyTo: '   ', references: [] })).toBeNull()
  })

  it('trims whitespace around the In-Reply-To value', () => {
    expect(reconstructThreadId({ inReplyTo: '  <p@h>  ' })).toBe('<p@h>')
  })
})
