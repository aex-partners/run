import { describe, it, expect } from 'vitest'
import { TaskBudget, DEFAULT_TASK_BUDGET, TaskBudgetLimits } from '@/contexts/tasks/domain/TaskBudget'

// Charge a sequence of tool classes, threading the next budget on each allow.
// Stops threading once a charge is denied (returns the denial).
const chargeSeq = (start: TaskBudget, classes: Parameters<TaskBudget['charge']>[0][]) => {
  let budget = start
  let lastDenied: { denied: string; reason: string } | null = null
  for (const c of classes) {
    const d = budget.charge(c)
    if (d.allowed) {
      budget = d.budget
    } else {
      lastDenied = { denied: d.denied, reason: d.reason }
    }
  }
  return { budget, lastDenied }
}

describe('TaskBudget defaults', () => {
  it('encodes the AEX defaults: 5 mutations / 0 deletes / 1 email', () => {
    expect(DEFAULT_TASK_BUDGET).toEqual({ mutations: 5, deletes: 0, emails: 1 })
  })

  it('starts with all counters at zero', () => {
    const b = TaskBudget.fromLimits(DEFAULT_TASK_BUDGET)
    expect(b.used).toEqual({ mutations: 0, deletes: 0, emails: 0 })
  })
})

describe('TaskBudget.charge readonly', () => {
  it('always allows readonly tools and consumes nothing', () => {
    const b = TaskBudget.fromLimits(DEFAULT_TASK_BUDGET)
    const d = b.charge('readonly')
    expect(d.allowed).toBe(true)
    if (!d.allowed) return
    // Returns the same budget instance; nothing consumed.
    expect(d.budget).toBe(b)
    expect(d.budget.used).toEqual({ mutations: 0, deletes: 0, emails: 0 })
  })
})

describe('TaskBudget.charge mutations', () => {
  it('allows exactly 5 mutations then denies the 6th', () => {
    const b = TaskBudget.fromLimits(DEFAULT_TASK_BUDGET)
    const { budget, lastDenied } = chargeSeq(b, ['mutation', 'mutation', 'mutation', 'mutation', 'mutation'])
    expect(budget.used.mutations).toBe(5)
    expect(lastDenied).toBeNull()

    const sixth = budget.charge('mutation')
    expect(sixth.allowed).toBe(false)
    if (sixth.allowed) return
    expect(sixth.denied).toBe('mutation')
    expect(sixth.reason).toMatch(/Mutation budget exhausted/)
  })
})

describe('TaskBudget.charge deletes', () => {
  it('denies every delete with the default budget of 0', () => {
    const b = TaskBudget.fromLimits(DEFAULT_TASK_BUDGET)
    const d = b.charge('delete')
    expect(d.allowed).toBe(false)
    if (d.allowed) return
    expect(d.denied).toBe('delete')
    expect(d.reason).toMatch(/delete_record is disabled/)
  })

  it('a delete also consumes a general mutation (cascade) when deletes are allowed', () => {
    const limits: TaskBudgetLimits = { mutations: 5, deletes: 2, emails: 1 }
    const b = TaskBudget.fromLimits(limits)
    const d = b.charge('delete')
    expect(d.allowed).toBe(true)
    if (!d.allowed) return
    expect(d.budget.used).toEqual({ mutations: 1, deletes: 1, emails: 0 })
  })
})

describe('TaskBudget.charge emails', () => {
  it('allows exactly 1 email then denies the 2nd', () => {
    const b = TaskBudget.fromLimits(DEFAULT_TASK_BUDGET)
    const first = b.charge('email')
    expect(first.allowed).toBe(true)
    if (!first.allowed) return
    // One email costs 1 email + 1 mutation (the cascade).
    expect(first.budget.used).toEqual({ mutations: 1, deletes: 0, emails: 1 })

    const second = first.budget.charge('email')
    expect(second.allowed).toBe(false)
    if (second.allowed) return
    expect(second.denied).toBe('email')
    expect(second.reason).toMatch(/send_email budget exhausted/)
  })

  it('denies an email by the MUTATION budget when mutations are exhausted (cascade interaction)', () => {
    const limits: TaskBudgetLimits = { mutations: 1, deletes: 0, emails: 1 }
    const b = TaskBudget.fromLimits(limits)
    const afterMutation = b.charge('mutation')
    expect(afterMutation.allowed).toBe(true)
    if (!afterMutation.allowed) return

    const email = afterMutation.budget.charge('email')
    expect(email.allowed).toBe(false)
    if (email.allowed) return
    // Denied by mutation, not email — the email slot was free but the mutation
    // cascade had none left.
    expect(email.denied).toBe('mutation')
  })
})

describe('TaskBudget atomicity / immutability', () => {
  it('an allowed charge never mutates the budget it was called on', () => {
    const b = TaskBudget.fromLimits(DEFAULT_TASK_BUDGET)
    const d = b.charge('mutation')
    expect(d.allowed).toBe(true)
    // The original is untouched; charge returns a fresh budget.
    expect(b.used).toEqual({ mutations: 0, deletes: 0, emails: 0 })
    if (d.allowed) expect(d.budget).not.toBe(b)
  })

  it('a denied charge never mutates the running counts', () => {
    const limits: TaskBudgetLimits = { mutations: 1, deletes: 0, emails: 1 }
    const b = TaskBudget.fromLimits(limits)
    const used1 = b.charge('mutation')
    expect(used1.allowed).toBe(true)
    if (!used1.allowed) return
    const exhausted = used1.budget

    // Attempt an email that gets denied by the mutation cascade — must not
    // consume the email slot.
    const denied = exhausted.charge('email')
    expect(denied.allowed).toBe(false)
    expect(exhausted.used).toEqual({ mutations: 1, deletes: 0, emails: 0 })
  })
})
