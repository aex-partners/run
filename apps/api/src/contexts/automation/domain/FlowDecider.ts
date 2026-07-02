import { Decider } from '@/shared/kernel/Decider'
import { Json } from '@/shared/domain/Json'
import { Flow } from '@/contexts/automation/domain/Flow'
import { Step } from '@/contexts/automation/domain/Step'
import { Effect } from '@/contexts/automation/domain/Effect'
import { RunEvent } from '@/contexts/automation/domain/RunEvent'
import { RunState } from '@/contexts/automation/domain/RunState'
import { resolveTemplate } from '@/contexts/automation/domain/VariableResolver'

// THE PURE CORE of the flow engine. Given the current state it decides the next
// effect (no IO); given a fact it folds new state. Deterministic and total, so a
// run resumes by replaying its events. `decide`'s input is unused (a tick) — the
// next move is fully determined by the cursor and the accumulated vars.
export class FlowDecider implements Decider<RunState, void, Effect, RunEvent> {
  constructor(private readonly flow: Flow) {}

  get initialState(): RunState {
    return { status: 'running', cursor: null, vars: {}, output: null, error: null }
  }

  decide(state: RunState): Effect[] {
    if (state.status !== 'running') return []
    if (state.cursor === null) return [{ kind: 'finish', output: state.output }]

    const step = this.flow.getStep(state.cursor)
    if (!step) return [{ kind: 'abort', stepId: state.cursor, reason: 'step not found' }]

    switch (step.type) {
      case 'piece':
        return [
          {
            kind: 'invokePiece',
            stepId: step.id,
            pieceId: step.pieceId,
            action: step.action,
            input: resolveTemplate(step.input, state.vars),
            next: step.next,
          },
        ]
      case 'code':
        return [
          {
            kind: 'runCode',
            stepId: step.id,
            code: step.code,
            input: resolveTemplate(step.input, state.vars),
            next: step.next,
          },
        ]
      case 'router':
        return [{ kind: 'route', from: step.id, to: this.pickBranch(step, state) }]
      case 'complete':
        return [{ kind: 'finish', output: resolveTemplate(step.output, state.vars) }]
    }
  }

  evolve(state: RunState, event: RunEvent): RunState {
    switch (event.type) {
      case 'started':
        return {
          status: 'running',
          cursor: this.flow.entryStepId,
          vars: { trigger: event.input },
          output: null,
          error: null,
        }
      case 'stepSucceeded':
        return {
          ...state,
          vars: { ...state.vars, [event.stepId]: event.output },
          output: event.output,
          cursor: event.next,
        }
      case 'routed':
        return { ...state, cursor: event.to }
      case 'finished':
        return { ...state, status: 'completed', output: event.output, cursor: null }
      case 'failed':
        return { ...state, status: 'failed', error: event.reason, cursor: null }
    }
  }

  private pickBranch(step: Extract<Step, { type: 'router' }>, state: RunState): string | null {
    for (const b of step.branches) {
      const actual = resolveTemplate(`{{${b.whenVar}}}`, state.vars)
      if (jsonEquals(actual, b.equals)) return b.goto
    }
    return step.otherwise
  }
}

const jsonEquals = (a: Json, b: Json): boolean => JSON.stringify(a) === JSON.stringify(b)
