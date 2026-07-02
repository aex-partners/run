import { ToolClass } from '@/contexts/assistant/domain/ToolClass'

// Pure decision rules for whether a tool call may proceed. Two policies, both
// IO-free:
//
//  - interactive (chat): a human is present, so MUTATING tools require an explicit
//    confirmation while READ-ONLY tools auto-allow. Ported from chat-handler's
//    `canUseTool` gate.
//  - background: no human to confirm (setup kickoff, scheduled work), so MUTATING
//    tools run against hard per-class budgets instead. Ported from
//    background-query.ts.

export function requiresConfirmation(cls: ToolClass): boolean {
  return cls === 'mutating'
}

// Per-class spend budgets for unattended runs. Read-only is unlimited; mutating is
// counted, with tighter sub-caps on irreversible (delete) and externally
// observable (email) operations. A pure tally — the caller feeds tool names and
// asks for the next decision.
export interface MutationBudgetLimits {
  mutations: number
  deletes: number
  emails: number
}

export const DEFAULT_BACKGROUND_LIMITS: MutationBudgetLimits = {
  mutations: 5,
  deletes: 0,
  emails: 0,
}

export type BudgetDecision = { allow: true } | { allow: false; message: string }

// Immutable-style tally: every decision returns the next state plus the verdict.
// Keeping it pure means the background runner stays a thin loop and the policy is
// unit-testable without a runtime.
export class MutationBudget {
  private constructor(
    private readonly limits: MutationBudgetLimits,
    private readonly used: MutationBudgetLimits,
  ) {}

  static start(limits: MutationBudgetLimits = DEFAULT_BACKGROUND_LIMITS): MutationBudget {
    return new MutationBudget(limits, { mutations: 0, deletes: 0, emails: 0 })
  }

  // Returns the verdict for a tool and the budget AFTER charging it. Read-only
  // tools never charge. Mirrors background-query.ts ordering: delete cap, then
  // email cap, then the overall mutation cap.
  decide(bareToolName: string, cls: ToolClass): { next: MutationBudget; decision: BudgetDecision } {
    if (cls === 'read-only') return { next: this, decision: { allow: true } }

    const used = { ...this.used }

    if (bareToolName === 'delete_record') {
      if (used.deletes >= this.limits.deletes) {
        return {
          next: this,
          decision: { allow: false, message: `delete_record is disabled in background queries (budget=${this.limits.deletes}).` },
        }
      }
      used.deletes += 1
    }

    if (bareToolName === 'send_email') {
      if (used.emails >= this.limits.emails) {
        return {
          next: this,
          decision: { allow: false, message: `send_email is disabled in background queries (budget=${this.limits.emails}).` },
        }
      }
      used.emails += 1
    }

    if (used.mutations >= this.limits.mutations) {
      return {
        next: this,
        decision: { allow: false, message: `Mutation budget exhausted for this background query (${this.limits.mutations}).` },
      }
    }
    used.mutations += 1

    return { next: new MutationBudget(this.limits, used), decision: { allow: true } }
  }
}
