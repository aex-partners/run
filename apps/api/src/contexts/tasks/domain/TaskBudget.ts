// VO. Per-execution safety budgets for unattended scheduled tasks. Read-only
// tools are unlimited; mutating tools are counted, with tighter sub-caps on the
// operations that are either irreversible (delete) or observable to third
// parties (email). Enforcement is PURE: `charge` returns the next budget on
// allow, or a denial (with the agent-facing message) on deny, and is atomic — a
// denied charge never mutates the running counts.
//
// The cascade mirrors AEX's `canUseTool`: a delete/email also consumes a general
// mutation, so one email costs 1 email + 1 mutation. With deletes=0, every delete
// is denied.

export interface TaskBudgetLimits {
  readonly mutations: number
  readonly deletes: number
  readonly emails: number
}

// AEX defaults (TASK_MUTATION_BUDGET=5, TASK_DELETE_BUDGET=0, TASK_EMAIL_BUDGET=1).
export const DEFAULT_TASK_BUDGET: TaskBudgetLimits = { mutations: 5, deletes: 0, emails: 1 }

// Classification of a tool call. The classification itself (which depends on
// AEX's `isReadOnlyTool` / tool names) is performed by the AgentRunner adapter;
// the budget only reasons over the class.
export type ToolClass = 'readonly' | 'mutation' | 'delete' | 'email'

export type BudgetDenial = 'delete' | 'email' | 'mutation'

export type BudgetDecision =
  | { readonly allowed: true; readonly budget: TaskBudget }
  | { readonly allowed: false; readonly denied: BudgetDenial; readonly reason: string }

interface BudgetUsed {
  readonly mutations: number
  readonly deletes: number
  readonly emails: number
}

export class TaskBudget {
  private constructor(
    public readonly limits: TaskBudgetLimits,
    public readonly used: BudgetUsed,
  ) {}

  static fromLimits(limits: TaskBudgetLimits): TaskBudget {
    return new TaskBudget(limits, { mutations: 0, deletes: 0, emails: 0 })
  }

  // PURE. Charge one tool call against the budget. Returns the next budget on
  // allow; a structured denial on deny.
  charge(toolClass: ToolClass): BudgetDecision {
    if (toolClass === 'readonly') return { allowed: true, budget: this }

    let { mutations, deletes, emails } = this.used

    if (toolClass === 'delete') {
      if (deletes >= this.limits.deletes) {
        return {
          allowed: false,
          denied: 'delete',
          reason: `delete_record is disabled in scheduled tasks (budget=${this.limits.deletes}). Ask the user to run this from chat so they can confirm.`,
        }
      }
      deletes += 1
    }

    if (toolClass === 'email') {
      if (emails >= this.limits.emails) {
        return {
          allowed: false,
          denied: 'email',
          reason: `send_email budget exhausted for this task (max ${this.limits.emails}).`,
        }
      }
      emails += 1
    }

    if (mutations >= this.limits.mutations) {
      return {
        allowed: false,
        denied: 'mutation',
        reason: `Mutation budget exhausted for this scheduled task (${this.limits.mutations}). Summarise what still needs to happen and stop.`,
      }
    }
    mutations += 1

    return { allowed: true, budget: new TaskBudget(this.limits, { mutations, deletes, emails }) }
  }
}
