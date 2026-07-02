import { describe, it, expect } from 'vitest'
import { FlowEngineInterpreter } from '@/contexts/automation/application/use-cases/FlowEngineInterpreter'
import {
  ActionType,
  TriggerType,
  StepStatus,
  FlowTrigger,
  FlowAction,
  PieceAction,
} from '@/contexts/automation/domain/FlowDsl'
import { RunEvent } from '@/contexts/automation/domain/engine/RunEvent'
import { PieceGateway } from '@/contexts/automation/application/ports/out/PieceGateway'
import { CodeSandbox } from '@/contexts/automation/application/ports/out/CodeSandbox'
import { EngineEventStore } from '@/contexts/automation/application/ports/out/EngineEventStore'
import { Json } from '@/shared/domain/Json'
import { Result, ok, fail } from '@/shared/kernel/Result'

// --- inline fakes ---------------------------------------------------------

class FakePieceGateway implements PieceGateway {
  readonly calls: { pieceId: string; action: string; input: Json }[] = []
  constructor(private readonly responder: () => Result<Json>) {}
  async invoke(call: { pieceId: string; action: string; input: Json }): Promise<Result<Json>> {
    this.calls.push(call)
    return this.responder()
  }
}

class FakeCodeSandbox implements CodeSandbox {
  readonly calls: { code: string; input: Json }[] = []
  constructor(private readonly responder: () => Result<Json> = () => ok({ done: true })) {}
  async run(call: { code: string; input: Json }): Promise<Result<Json>> {
    this.calls.push(call)
    return this.responder()
  }
}

class InMemoryEngineStore implements EngineEventStore {
  readonly logs = new Map<string, RunEvent[]>()
  async append(runId: string, event: RunEvent): Promise<void> {
    const log = this.logs.get(runId) ?? []
    log.push(event)
    this.logs.set(runId, log)
  }
  async load(runId: string): Promise<RunEvent[]> {
    return [...(this.logs.get(runId) ?? [])]
  }
}

// --- builders -------------------------------------------------------------

const piece = (name: string, input: Record<string, Json> = {}, over: Partial<PieceAction['settings']> = {}, nextAction?: FlowAction): PieceAction => ({
  name,
  displayName: name,
  valid: true,
  type: ActionType.PIECE,
  settings: { pieceName: 'http', actionName: 'get', input, ...over },
  nextAction,
})

const codeAct = (name: string, input: Record<string, Json> = {}, nextAction?: FlowAction): FlowAction => ({
  name,
  displayName: name,
  valid: true,
  type: ActionType.CODE,
  settings: { sourceCode: 'return 1', input },
  nextAction,
})

const trigger = (nextAction?: FlowAction): FlowTrigger => ({
  name: 'trigger',
  displayName: 'Trigger',
  type: TriggerType.WEBHOOK,
  valid: true,
  settings: {},
  nextAction,
})

describe('FlowEngineInterpreter.run', () => {
  it('drives trigger -> piece -> code to completion and records the log', async () => {
    const pieces = new FakePieceGateway(() => ok({ tone: 'ok' }))
    const sandbox = new FakeCodeSandbox(() => ok({ done: true }))
    const store = new InMemoryEngineStore()
    const interp = new FlowEngineInterpreter(pieces, sandbox, store)

    const flow = trigger(piece('step_1', { to: '{{trigger.name}}' }, {}, codeAct('step_2', { v: '{{step_1.tone}}' })))
    const state = await interp.run(flow, 'run-1', { name: 'Ada' })

    expect(state.status).toBe('succeeded')
    expect(state.steps.step_1).toMatchObject({ status: StepStatus.SUCCEEDED, output: { tone: 'ok' } })
    expect(state.steps.step_2).toMatchObject({ status: StepStatus.SUCCEEDED, output: { done: true } })

    // Piece saw the resolved input; code saw the upstream piece output.
    expect(pieces.calls).toEqual([{ pieceId: 'http', action: 'get', input: { to: 'Ada' } }])
    expect(sandbox.calls).toEqual([{ code: 'return 1', input: { v: 'ok' } }])

    const log = await store.load('run-1')
    expect(log.map((e) => e.type)).toEqual(['started', 'stepSucceeded', 'stepSucceeded', 'finished'])
  })

  it('resume continues from the recorded log without re-invoking past steps', async () => {
    const pieces = new FakePieceGateway(() => ok({ tone: 'ok' }))
    const sandbox = new FakeCodeSandbox(() => ok({ done: true }))
    const store = new InMemoryEngineStore()

    const flow = trigger(piece('step_1', {}, {}, codeAct('step_2')))
    await store.append('run-1', { type: 'started', triggerName: 'trigger', triggerOutput: { name: 'Ada' } })
    await store.append('run-1', { type: 'stepSucceeded', name: 'step_1', atype: ActionType.PIECE, input: {}, output: { tone: 'ok' }, duration: 7, path: [] })

    const interp = new FlowEngineInterpreter(pieces, sandbox, store)
    const state = await interp.resume(flow, 'run-1')

    expect(state.status).toBe('succeeded')
    expect(pieces.calls).toHaveLength(0)
    expect(sandbox.calls).toHaveLength(1)
    const log = await store.load('run-1')
    expect(log.map((e) => e.type)).toEqual(['started', 'stepSucceeded', 'stepSucceeded', 'finished'])
  })

  it('a failing piece fails the whole run (continueOnFailure off)', async () => {
    const pieces = new FakePieceGateway(() => fail('upstream 500'))
    const sandbox = new FakeCodeSandbox()
    const store = new InMemoryEngineStore()
    const interp = new FlowEngineInterpreter(pieces, sandbox, store)

    const flow = trigger(piece('step_1', {}, {}, codeAct('step_2')))
    const state = await interp.run(flow, 'run-1', null)

    expect(state.status).toBe('failed')
    expect(state.error).toBe('upstream 500')
    expect(state.steps.step_1).toMatchObject({ status: StepStatus.FAILED, errorMessage: 'upstream 500' })
    expect(sandbox.calls).toHaveLength(0)
    const log = await store.load('run-1')
    expect(log.map((e) => e.type)).toEqual(['started', 'stepFailed'])
  })

  it('continueOnFailure lets the run proceed past a failing piece', async () => {
    const pieces = new FakePieceGateway(() => fail('upstream 500'))
    const sandbox = new FakeCodeSandbox(() => ok({ done: true }))
    const store = new InMemoryEngineStore()
    const interp = new FlowEngineInterpreter(pieces, sandbox, store)

    const failing = piece('step_1', {}, { errorHandlingOptions: { continueOnFailure: { value: true } } }, codeAct('step_2'))
    const state = await interp.run(trigger(failing), 'run-1', null)

    expect(state.status).toBe('succeeded')
    expect(state.steps.step_1).toMatchObject({ status: StepStatus.FAILED, output: { error: 'upstream 500' } })
    expect(state.steps.step_2).toMatchObject({ status: StepStatus.SUCCEEDED })
    expect(sandbox.calls).toHaveLength(1)
    const log = await store.load('run-1')
    expect(log.map((e) => e.type)).toEqual(['started', 'stepFailed', 'stepSucceeded', 'finished'])
  })
})
