import { Json } from '@/shared/domain/Json'
import { ActionType, FlowTrigger } from '@/contexts/automation/domain/FlowDsl'
import { ExecutionPath } from '@/contexts/automation/domain/ExecutionState'
import { FlowDecider } from '@/contexts/automation/domain/engine/FlowDecider'
import { RunState } from '@/contexts/automation/domain/engine/RunState'
import { Effect } from '@/contexts/automation/domain/engine/Effect'
import { RunEvent } from '@/contexts/automation/domain/engine/RunEvent'
import { PieceGateway } from '@/contexts/automation/application/ports/out/PieceGateway'
import { CodeSandbox } from '@/contexts/automation/application/ports/out/CodeSandbox'
import { EngineEventStore } from '@/contexts/automation/application/ports/out/EngineEventStore'

const MAX_STEPS = 100_000 // runaway guard (loops expand the stack eagerly)

// THE IMPERATIVE SHELL for the real engine. It owns all IO: it performs each pure
// Effect (piece invocation / code execution behind driven ports; the rest are
// no-op control echoes), records the resulting fact, and folds it back via the
// engine FlowDecider. The hard walk/loop/router orchestration stays pure in the
// decider; this is a thin driving loop, symmetric to the skeleton's FlowInterpreter.
export class FlowEngineInterpreter {
  constructor(
    private readonly pieces: PieceGateway,
    private readonly sandbox: CodeSandbox,
    private readonly store: EngineEventStore,
  ) {}

  // Fresh run. `triggerPayload` is the live item that fired (polling/webhook) or
  // null (schedule), falling back to the trigger's static input. Ported from
  // `executeFlow`'s trigger-step seeding.
  async run(trigger: FlowTrigger, runId: string, triggerPayload: Json | null): Promise<RunState> {
    const decider = new FlowDecider(trigger)
    const triggerOutput: Json = triggerPayload ?? trigger.settings.input ?? {}
    const seeded = await this.record(decider, decider.initialState, runId, {
      type: 'started',
      triggerName: trigger.name,
      triggerOutput,
    })
    return this.drive(decider, seeded, runId)
  }

  // Crash recovery: rebuild state from the recorded events, then keep driving. No
  // effect is re-performed because evolve, not perform, reconstructs state.
  async resume(trigger: FlowTrigger, runId: string): Promise<RunState> {
    const decider = new FlowDecider(trigger)
    let state = decider.initialState
    for (const event of await this.store.load(runId)) state = decider.evolve(state, event)
    return this.drive(decider, state, runId)
  }

  private async drive(decider: FlowDecider, start: RunState, runId: string): Promise<RunState> {
    let state = start
    let steps = 0
    while (state.status === 'running') {
      if (steps++ > MAX_STEPS) throw new Error('FlowEngineInterpreter: step limit exceeded')
      const effects = decider.decide(state)
      if (effects.length === 0) break
      for (const effect of effects) {
        state = await this.record(decider, state, runId, await this.perform(effect))
      }
    }
    return state
  }

  private async record(
    decider: FlowDecider,
    state: RunState,
    runId: string,
    event: RunEvent,
  ): Promise<RunState> {
    await this.store.append(runId, event)
    return decider.evolve(state, event)
  }

  private async perform(effect: Effect): Promise<RunEvent> {
    switch (effect.kind) {
      case 'invokePiece': {
        const startedAt = Date.now()
        const r = await this.pieces.invoke({
          pieceId: effect.pieceName,
          action: effect.actionName,
          input: effect.input,
          credentialId: effect.credentialId,
        })
        const duration = Date.now() - startedAt
        if (r.ok) {
          return {
            type: 'stepSucceeded',
            name: effect.name,
            atype: ActionType.PIECE,
            input: effect.input,
            output: r.value,
            duration,
            path: effect.path,
          }
        }
        return this.failure(ActionType.PIECE, effect.name, effect.input, r.error, duration, effect.continueOnFailure, effect.path)
      }
      case 'runCode': {
        const startedAt = Date.now()
        const r = await this.sandbox.run({ code: effect.sourceCode, input: effect.input })
        const duration = Date.now() - startedAt
        if (r.ok) {
          return {
            type: 'stepSucceeded',
            name: effect.name,
            atype: ActionType.CODE,
            input: effect.input,
            output: r.value,
            duration,
            path: effect.path,
          }
        }
        return this.failure(ActionType.CODE, effect.name, effect.input, r.error, duration, effect.continueOnFailure, effect.path)
      }
      case 'skip':
        return { type: 'stepSkipped', name: effect.name, atype: effect.atype, path: effect.path }
      case 'enterLoop':
        return {
          type: 'loopEntered',
          name: effect.name,
          itemsExpr: effect.itemsExpr,
          items: effect.items,
          hasBody: effect.hasBody,
          path: effect.path,
        }
      case 'iterate':
        return {
          type: 'loopIterationStarted',
          name: effect.name,
          index: effect.index,
          item: effect.item,
          total: effect.total,
          path: effect.path,
        }
      case 'finalizeLoop':
        return { type: 'loopFinalized', name: effect.name, path: effect.path }
      case 'enterRouter':
        return {
          type: 'routerEntered',
          name: effect.name,
          input: effect.input,
          branchResults: effect.branchResults,
          selected: effect.selected,
          path: effect.path,
        }
      case 'finish':
        return { type: 'finished' }
    }
  }

  // Map an IO failure to a stepFailed fact, honouring continueOnFailure exactly as
  // the source executors do (FAILED with `{ error }` output but keep running, vs.
  // FAILED with null output and stop).
  private failure(
    atype: ActionType,
    name: string,
    input: Json,
    error: string,
    duration: number,
    continueOnFailure: boolean,
    path: ExecutionPath[],
  ): RunEvent {
    return {
      type: 'stepFailed',
      name,
      atype,
      input,
      output: continueOnFailure ? { error } : null,
      duration,
      errorMessage: error,
      continued: continueOnFailure,
      path,
    }
  }
}
