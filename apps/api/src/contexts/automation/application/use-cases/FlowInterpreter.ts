import { RunState } from '@/contexts/automation/domain/RunState'
import { RunEvent } from '@/contexts/automation/domain/RunEvent'
import { Effect } from '@/contexts/automation/domain/Effect'
import { Flow } from '@/contexts/automation/domain/Flow'
import { FlowDecider } from '@/contexts/automation/domain/FlowDecider'
import { Json } from '@/shared/domain/Json'
import { PieceGateway } from '@/contexts/automation/application/ports/out/PieceGateway'
import { CodeSandbox } from '@/contexts/automation/application/ports/out/CodeSandbox'
import { RunEventStore } from '@/contexts/automation/application/ports/out/RunEventStore'

const MAX_STEPS = 10_000 // runaway guard

// THE IMPERATIVE SHELL. It owns all the IO: it performs each pure Effect through
// a driven port, records the resulting fact, and folds it back via the decider.
// The hard orchestration logic stays in the pure FlowDecider; this class is a
// thin, dumb loop.
export class FlowInterpreter {
  constructor(
    private readonly pieces: PieceGateway,
    private readonly sandbox: CodeSandbox,
    private readonly store: RunEventStore,
  ) {}

  async run(flow: Flow, runId: string, input: Json): Promise<RunState> {
    const decider = new FlowDecider(flow)
    let state = await this.record(decider, decider.initialState, runId, { type: 'started', input })
    return this.drive(decider, state, runId)
  }

  // Crash recovery: rebuild state from the event log, then keep driving. No
  // effect is re-performed because evolve, not perform, reconstructs state.
  async resume(flow: Flow, runId: string): Promise<RunState> {
    const decider = new FlowDecider(flow)
    let state = decider.initialState
    for (const event of await this.store.load(runId)) state = decider.evolve(state, event)
    return this.drive(decider, state, runId)
  }

  private async drive(decider: FlowDecider, start: RunState, runId: string): Promise<RunState> {
    let state = start
    let steps = 0
    while (state.status === 'running') {
      if (steps++ > MAX_STEPS) throw new Error('FlowInterpreter: step limit exceeded')
      for (const effect of decider.decide(state)) {
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
        const r = await this.pieces.invoke({
          pieceId: effect.pieceId,
          action: effect.action,
          input: effect.input,
        })
        return r.ok
          ? { type: 'stepSucceeded', stepId: effect.stepId, output: r.value, next: effect.next }
          : { type: 'failed', stepId: effect.stepId, reason: r.error }
      }
      case 'runCode': {
        const r = await this.sandbox.run({ code: effect.code, input: effect.input })
        return r.ok
          ? { type: 'stepSucceeded', stepId: effect.stepId, output: r.value, next: effect.next }
          : { type: 'failed', stepId: effect.stepId, reason: r.error }
      }
      case 'route':
        return { type: 'routed', from: effect.from, to: effect.to }
      case 'finish':
        return { type: 'finished', output: effect.output }
      case 'abort':
        return { type: 'failed', stepId: effect.stepId, reason: effect.reason }
    }
  }
}
