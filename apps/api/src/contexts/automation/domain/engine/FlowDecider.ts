import { Decider } from '@/shared/kernel/Decider'
import { Json } from '@/shared/domain/Json'
import {
  ActionType,
  FlowTrigger,
  FlowAction,
  LoopAction,
  RouterAction,
  StepOutput,
  StepStatus,
} from '@/contexts/automation/domain/FlowDsl'
import { resolveVariables } from '@/contexts/automation/domain/Variables'
import { evaluateConditions } from '@/contexts/automation/domain/RouterConditions'
import {
  currentState,
  upsertStep,
  startLoopIteration,
  finalizeLoopStep,
  ExecutionPath,
} from '@/contexts/automation/domain/ExecutionState'
import { RunState, Frame } from '@/contexts/automation/domain/engine/RunState'
import { Effect, BranchResult } from '@/contexts/automation/domain/engine/Effect'
import { RunEvent } from '@/contexts/automation/domain/engine/RunEvent'

// THE PURE CORE of the real AEX flow engine. Ports the recursive walk of
// `flow-executor.ts` + the type-specific executors into a deterministic, total
// decider over an explicit continuation stack (see RunState). `decide` reads the
// top frame and yields the next effect; `evolve` folds a fact and reshapes the
// stack. No IO, no clock: durations and IO results arrive via events from the
// imperative shell.
export class FlowDecider implements Decider<RunState, void, Effect, RunEvent> {
  private readonly byName = new Map<string, FlowAction>()

  constructor(private readonly trigger: FlowTrigger) {
    indexActions(trigger.nextAction, this.byName)
  }

  get initialState(): RunState {
    return { status: 'running', steps: {}, stack: [], error: null, duration: 0 }
  }

  decide(state: RunState): Effect[] {
    if (state.status !== 'running') return []
    const frame = state.stack[0]
    if (!frame) return [{ kind: 'finish' }]

    switch (frame.kind) {
      case 'finalizeLoop':
        return [{ kind: 'finalizeLoop', name: frame.name, path: frame.path }]
      case 'loopIterate':
        return [
          {
            kind: 'iterate',
            name: frame.name,
            index: frame.index,
            item: frame.item,
            total: frame.total,
            path: frame.path,
          },
        ]
      case 'action':
        return [this.decideAction(frame.action, frame.path, state)]
    }
  }

  private decideAction(action: FlowAction, path: ExecutionPath[], state: RunState): Effect {
    if (action.skip) return { kind: 'skip', name: action.name, atype: action.type, path }

    const vars = currentState(state.steps, path)

    switch (action.type) {
      case ActionType.PIECE:
        return {
          kind: 'invokePiece',
          name: action.name,
          pieceName: action.settings.pieceName,
          pieceVersion: action.settings.pieceVersion,
          actionName: action.settings.actionName,
          input: resolveVariables(action.settings.input, vars),
          credentialId: action.settings.credentialId,
          continueOnFailure: continueOnFailure(action),
          path,
        }
      case ActionType.CODE:
        return {
          kind: 'runCode',
          name: action.name,
          sourceCode: action.settings.sourceCode,
          input: resolveVariables(action.settings.input, vars),
          continueOnFailure: continueOnFailure(action),
          path,
        }
      case ActionType.LOOP_ON_ITEMS: {
        const resolved = resolveVariables(action.settings.items, vars)
        const items = Array.isArray(resolved) ? resolved : []
        return {
          kind: 'enterLoop',
          name: action.name,
          itemsExpr: action.settings.items,
          items,
          hasBody: action.firstLoopAction !== undefined,
          path,
        }
      }
      case ActionType.ROUTER: {
        const { branchResults, selected } = evaluateRouter(action, vars)
        return {
          kind: 'enterRouter',
          name: action.name,
          input: { branches: action.settings.branches.map((b) => b.branchName) },
          branchResults,
          selected,
          path,
        }
      }
    }
  }

  evolve(state: RunState, event: RunEvent): RunState {
    switch (event.type) {
      case 'started': {
        const triggerStep: StepOutput = {
          type: ActionType.PIECE,
          status: StepStatus.SUCCEEDED,
          input: (this.trigger.settings as unknown as Json) ?? null,
          output: event.triggerOutput,
          duration: 0,
        }
        return {
          status: 'running',
          steps: { [event.triggerName]: triggerStep },
          stack: scheduleChain(this.trigger.nextAction, []),
          error: null,
          duration: 0,
        }
      }

      case 'stepSucceeded': {
        const steps = upsertStep(state.steps, event.path, event.name, {
          type: event.atype,
          status: StepStatus.SUCCEEDED,
          input: event.input,
          output: event.output,
          duration: event.duration,
        })
        return { ...state, steps, stack: pop(state.stack), duration: state.duration + event.duration }
      }

      case 'stepSkipped': {
        const steps = upsertStep(state.steps, event.path, event.name, {
          type: event.atype,
          status: StepStatus.SKIPPED,
          input: null,
          output: null,
          duration: 0,
        })
        return { ...state, steps, stack: pop(state.stack) }
      }

      case 'stepFailed': {
        const steps = upsertStep(state.steps, event.path, event.name, {
          type: event.atype,
          status: StepStatus.FAILED,
          input: event.input,
          output: event.output,
          duration: event.duration,
          errorMessage: event.errorMessage,
        })
        const duration = state.duration + event.duration
        if (event.continued) return { ...state, steps, stack: pop(state.stack), duration }
        // Non-recoverable failure: drop the rest of the stack and stop.
        return { ...state, steps, stack: [], status: 'failed', error: event.errorMessage, duration }
      }

      case 'loopEntered': {
        const loopStep: StepOutput = {
          type: ActionType.LOOP_ON_ITEMS,
          status: StepStatus.RUNNING,
          input: { items: event.itemsExpr },
          output: { iterations: event.items.length },
          duration: 0,
          iterations: {},
        }
        const steps = upsertStep(state.steps, event.path, event.name, loopStep)
        const loopNode = this.byName.get(event.name) as LoopAction | undefined
        const body = loopNode?.firstLoopAction
        const frames: Frame[] = []
        if (event.hasBody && event.items.length > 0) {
          for (let i = 0; i < event.items.length; i++) {
            frames.push({
              kind: 'loopIterate',
              name: event.name,
              index: i,
              item: event.items[i]!,
              total: event.items.length,
              path: event.path,
            })
            frames.push(...scheduleChain(body, [...event.path, { stepName: event.name, iteration: i }]))
          }
        }
        frames.push({ kind: 'finalizeLoop', name: event.name, path: event.path })
        return { ...state, steps, stack: [...frames, ...pop(state.stack)] }
      }

      case 'loopIterationStarted': {
        const steps = startLoopIteration(
          state.steps,
          event.path,
          event.name,
          event.index,
          event.item,
          event.total,
        )
        return { ...state, steps, stack: pop(state.stack) }
      }

      case 'loopFinalized': {
        const steps = finalizeLoopStep(state.steps, event.path, event.name)
        return { ...state, steps, stack: pop(state.stack) }
      }

      case 'routerEntered': {
        const routerStep: StepOutput = {
          type: ActionType.ROUTER,
          status: StepStatus.SUCCEEDED,
          input: event.input,
          output: { branches: event.branchResults as unknown as Json },
          duration: 0,
        }
        const steps = upsertStep(state.steps, event.path, event.name, routerStep)
        const routerNode = this.byName.get(event.name) as RouterAction | undefined
        const frames: Frame[] = []
        for (const idx of event.selected) {
          const child = routerNode?.children[idx]
          frames.push(...scheduleChain(child ?? undefined, event.path))
        }
        return { ...state, steps, stack: [...frames, ...pop(state.stack)] }
      }

      case 'finished':
        return { ...state, status: 'succeeded', stack: [] }
    }
  }
}

// --- pure helpers ---

const pop = (stack: Frame[]): Frame[] => stack.slice(1)

// Schedule one sibling chain (an action and its `nextAction` successors) as
// `action` frames, head first. Does NOT descend into loop bodies / router
// children; those expand when their own frame is processed.
function scheduleChain(action: FlowAction | undefined, path: ExecutionPath[]): Frame[] {
  const frames: Frame[] = []
  let current: FlowAction | undefined = action
  while (current) {
    frames.push({ kind: 'action', action: current, path })
    current = current.nextAction
  }
  return frames
}

// Index every action by name (recursing into loop bodies + router branches) so
// evolve can re-derive nodes from a lean event.
function indexActions(action: FlowAction | undefined, into: Map<string, FlowAction>): void {
  let current: FlowAction | undefined = action
  while (current) {
    into.set(current.name, current)
    if (current.type === ActionType.LOOP_ON_ITEMS) {
      indexActions(current.firstLoopAction, into)
    } else if (current.type === ActionType.ROUTER) {
      for (const child of current.children ?? []) indexActions(child ?? undefined, into)
    }
    current = current.nextAction
  }
}

// Evaluate every branch (pure), then pick which branch chains run, faithfully to
// `router-executor.ts`: FALLBACK matches only if nothing matched yet, and
// EXECUTE_FIRST_MATCH stops after the first match.
function evaluateRouter(
  action: RouterAction,
  vars: ReturnType<typeof currentState>,
): { branchResults: BranchResult[]; selected: number[] } {
  const { branches, executionType } = action.settings
  const branchResults: BranchResult[] = []
  const selected: number[] = []
  let anyMatched = false

  for (let i = 0; i < branches.length; i++) {
    const branch = branches[i]!
    let evaluation = false
    if (branch.branchType === 'FALLBACK') {
      evaluation = !anyMatched
    } else if (branch.conditions) {
      evaluation = evaluateConditions(branch.conditions, vars)
    }

    branchResults.push({ branchName: branch.branchName, branchIndex: i, evaluation })

    if (evaluation) {
      anyMatched = true
      selected.push(i)
      if (executionType === 'EXECUTE_FIRST_MATCH') break
    }
  }

  return { branchResults, selected }
}

function continueOnFailure(action: { settings: { errorHandlingOptions?: { continueOnFailure?: { value: boolean } } } }): boolean {
  return action.settings.errorHandlingOptions?.continueOnFailure?.value === true
}
