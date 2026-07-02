import { AggregateRoot } from '@/shared/kernel/AggregateRoot'
import { Result, ok, fail } from '@/shared/kernel/Result'
import { FlowId } from '@/contexts/automation/domain/ids'
import { Step } from '@/contexts/automation/domain/Step'

// Aggregate. Guards what a VALID flow graph is: unique step ids, an existing
// entry step, and every jump target (next / goto / otherwise) pointing at a real
// step. This validation is pure and runs before any execution.
export class Flow extends AggregateRoot<FlowId> {
  private constructor(
    id: FlowId,
    public readonly name: string,
    public readonly entryStepId: string,
    private readonly steps: ReadonlyMap<string, Step>,
  ) {
    super(id)
  }

  static create(id: FlowId, name: string, entryStepId: string, steps: Step[]): Result<Flow> {
    const byId = new Map<string, Step>()
    for (const s of steps) {
      if (byId.has(s.id)) return fail(`Flow: duplicate step id "${s.id}"`)
      byId.set(s.id, s)
    }
    if (!byId.has(entryStepId)) return fail(`Flow: entry step "${entryStepId}" not found`)

    for (const s of steps) {
      for (const target of jumpTargets(s)) {
        if (target !== null && !byId.has(target)) {
          return fail(`Flow: step "${s.id}" jumps to unknown step "${target}"`)
        }
      }
    }
    return ok(new Flow(id, name, entryStepId, byId))
  }

  getStep(id: string): Step | null {
    return this.steps.get(id) ?? null
  }
}

const jumpTargets = (s: Step): (string | null)[] => {
  switch (s.type) {
    case 'piece':
    case 'code':
      return [s.next]
    case 'router':
      return [...s.branches.map((b) => b.goto), s.otherwise]
    case 'complete':
      return []
  }
}
