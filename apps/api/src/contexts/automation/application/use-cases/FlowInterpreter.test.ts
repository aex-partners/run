import { describe, it, expect } from 'vitest'
import { FlowInterpreter } from '@/contexts/automation/application/use-cases/FlowInterpreter'
import { Flow } from '@/contexts/automation/domain/Flow'
import { Step } from '@/contexts/automation/domain/Step'
import { FlowId } from '@/contexts/automation/domain/ids'
import { RunEvent } from '@/contexts/automation/domain/RunEvent'
import { PieceGateway } from '@/contexts/automation/application/ports/out/PieceGateway'
import { CodeSandbox } from '@/contexts/automation/application/ports/out/CodeSandbox'
import { RunEventStore } from '@/contexts/automation/application/ports/out/RunEventStore'
import { Json } from '@/shared/domain/Json'
import { Result, ok, fail } from '@/shared/kernel/Result'

// --- inline in-memory fakes ----------------------------------------------

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
  constructor(private readonly responder: () => Result<Json>) {}
  async run(call: { code: string; input: Json }): Promise<Result<Json>> {
    this.calls.push(call)
    return this.responder()
  }
}

class InMemoryStore implements RunEventStore {
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

const linearFlow = (): Flow => {
  const steps: Step[] = [
    { id: 'a', type: 'piece', pieceId: 'http', action: 'get', input: { url: '{{trigger.url}}' }, next: 'b' },
    { id: 'b', type: 'code', code: 'return x*2', input: { v: '{{a.status}}' }, next: 'c' },
    { id: 'c', type: 'complete', output: '{{b.doubled}}' },
  ]
  const r = Flow.create(FlowId.of('flow-1'), 'demo', 'a', steps)
  if (!r.ok) throw new Error(r.error)
  return r.value
}

describe('FlowInterpreter.run', () => {
  it('drives a flow to completion and records the full event log', async () => {
    const pieces = new FakePieceGateway(() => ok({ status: 200 }))
    const sandbox = new FakeCodeSandbox(() => ok({ doubled: 84 }))
    const store = new InMemoryStore()
    const interp = new FlowInterpreter(pieces, sandbox, store)

    const state = await interp.run(linearFlow(), 'run-1', { url: 'http://x' })

    expect(state.status).toBe('completed')
    expect(state.output).toBe(84)
    expect(state.vars).toEqual({ trigger: { url: 'http://x' }, a: { status: 200 }, b: { doubled: 84 } })

    // The piece received the resolved input.
    expect(pieces.calls).toEqual([{ pieceId: 'http', action: 'get', input: { url: 'http://x' } }])
    expect(sandbox.calls).toEqual([{ code: 'return x*2', input: { v: 200 } }])

    const log = await store.load('run-1')
    expect(log.map((e) => e.type)).toEqual(['started', 'stepSucceeded', 'stepSucceeded', 'finished'])
  })

  it('resume rebuilds from the event log and continues without re-performing past effects', async () => {
    const pieces = new FakePieceGateway(() => ok({ status: 200 }))
    const sandbox = new FakeCodeSandbox(() => ok({ doubled: 84 }))
    const store = new InMemoryStore()

    // Pre-load events as if the piece step already ran before a crash.
    await store.append('run-1', { type: 'started', input: { url: 'http://x' } })
    await store.append('run-1', { type: 'stepSucceeded', stepId: 'a', output: { status: 200 }, next: 'b' })

    const interp = new FlowInterpreter(pieces, sandbox, store)
    const state = await interp.resume(linearFlow(), 'run-1')

    expect(state.status).toBe('completed')
    expect(state.output).toBe(84)
    // The already-recorded piece step is NOT re-invoked; only the code step runs.
    expect(pieces.calls).toHaveLength(0)
    expect(sandbox.calls).toHaveLength(1)

    const log = await store.load('run-1')
    expect(log.map((e) => e.type)).toEqual(['started', 'stepSucceeded', 'stepSucceeded', 'finished'])
  })

  it('a failing piece fails the run', async () => {
    const pieces = new FakePieceGateway(() => fail('upstream 500'))
    const sandbox = new FakeCodeSandbox(() => ok({ doubled: 1 }))
    const store = new InMemoryStore()
    const interp = new FlowInterpreter(pieces, sandbox, store)

    const state = await interp.run(linearFlow(), 'run-1', { url: 'http://x' })

    expect(state.status).toBe('failed')
    expect(state.error).toBe('upstream 500')
    expect(sandbox.calls).toHaveLength(0)
    const log = await store.load('run-1')
    expect(log.map((e) => e.type)).toEqual(['started', 'failed'])
  })
})
