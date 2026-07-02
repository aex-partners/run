import { describe, it, expect } from 'vitest'
import { Scope } from '@/contexts/knowledge/domain/Scope'

describe('Scope', () => {
  it('company is shared, not personal', () => {
    const s = Scope.company()
    expect(s.isShared()).toBe(true)
    expect(s.isPersonal()).toBe(false)
    expect(s.kind).toBe('company')
  })

  it('personal is private, not shared', () => {
    const s = Scope.personal()
    expect(s.isShared()).toBe(false)
    expect(s.isPersonal()).toBe(true)
  })

  it('of() accepts the two valid values', () => {
    expect(Scope.of('company').ok).toBe(true)
    expect(Scope.of('personal').ok).toBe(true)
  })

  it('of() rejects anything else', () => {
    const r = Scope.of('team')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('company')
  })

  it('equals compares by kind', () => {
    expect(Scope.company().equals(Scope.company())).toBe(true)
    expect(Scope.company().equals(Scope.personal())).toBe(false)
  })
})
