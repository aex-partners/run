import { describe, it, expect } from 'vitest'
import {
  requiresConfirmation,
  MutationBudget,
  DEFAULT_BACKGROUND_LIMITS,
} from '@/contexts/assistant/domain/ConfirmationPolicy'

describe('requiresConfirmation', () => {
  it('gates mutating tools and auto-allows read-only ones', () => {
    expect(requiresConfirmation('mutating')).toBe(true)
    expect(requiresConfirmation('read-only')).toBe(false)
  })
})

describe('MutationBudget', () => {
  it('never charges a read-only tool and returns the same instance', () => {
    const b = MutationBudget.start()
    const r = b.decide('query', 'read-only')
    expect(r.decision.allow).toBe(true)
    expect(r.next).toBe(b)
  })

  it('allows mutations up to the cap then denies', () => {
    let b = MutationBudget.start({ mutations: 2, deletes: 0, emails: 0 })

    const r1 = b.decide('create_entity', 'mutating')
    expect(r1.decision.allow).toBe(true)
    b = r1.next

    const r2 = b.decide('update_record', 'mutating')
    expect(r2.decision.allow).toBe(true)
    b = r2.next

    const r3 = b.decide('insert_record', 'mutating')
    expect(r3.decision.allow).toBe(false)
    if (!r3.decision.allow) expect(r3.decision.message).toContain('Mutation budget exhausted')
  })

  it('denies delete_record under the default zero delete budget', () => {
    const b = MutationBudget.start(DEFAULT_BACKGROUND_LIMITS)
    const r = b.decide('delete_record', 'mutating')
    expect(r.decision.allow).toBe(false)
    if (!r.decision.allow) expect(r.decision.message).toContain('delete_record is disabled')
  })

  it('denies send_email under the default zero email budget', () => {
    const b = MutationBudget.start(DEFAULT_BACKGROUND_LIMITS)
    const r = b.decide('send_email', 'mutating')
    expect(r.decision.allow).toBe(false)
    if (!r.decision.allow) expect(r.decision.message).toContain('send_email is disabled')
  })

  it('honours an explicit delete sub-cap (delete also consumes a mutation slot)', () => {
    let b = MutationBudget.start({ mutations: 5, deletes: 1, emails: 0 })

    const r1 = b.decide('delete_record', 'mutating')
    expect(r1.decision.allow).toBe(true)
    b = r1.next

    const r2 = b.decide('delete_record', 'mutating')
    expect(r2.decision.allow).toBe(false)
  })

  it('honours an explicit email sub-cap', () => {
    let b = MutationBudget.start({ mutations: 5, deletes: 0, emails: 1 })

    const r1 = b.decide('send_email', 'mutating')
    expect(r1.decision.allow).toBe(true)
    b = r1.next

    const r2 = b.decide('send_email', 'mutating')
    expect(r2.decision.allow).toBe(false)
  })

  it('is immutable: deciding does not mutate the original tally', () => {
    const b = MutationBudget.start({ mutations: 1, deletes: 0, emails: 0 })
    const r1 = b.decide('create_entity', 'mutating')
    const r2 = b.decide('create_entity', 'mutating')
    // Both see a fresh budget; the original was never charged.
    expect(r1.decision.allow).toBe(true)
    expect(r2.decision.allow).toBe(true)
  })

  it('exposes the documented default background limits', () => {
    expect(DEFAULT_BACKGROUND_LIMITS).toEqual({ mutations: 5, deletes: 0, emails: 0 })
  })
})
