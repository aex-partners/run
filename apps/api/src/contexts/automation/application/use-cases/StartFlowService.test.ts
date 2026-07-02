import { describe, it, expect } from 'vitest'
import { StartFlowService } from '@/contexts/automation/application/use-cases/StartFlowService'
import { FlowInterpreter } from '@/contexts/automation/application/use-cases/FlowInterpreter'
import { Flow } from '@/contexts/automation/domain/Flow'
import { Step } from '@/contexts/automation/domain/Step'
import { RunEvent } from '@/contexts/automation/domain/RunEvent'
import { FlowId, RunId } from '@/contexts/automation/domain/ids'
import { FlowRepository } from '@/contexts/automation/application/ports/out/FlowRepository'
import { PieceGateway } from '@/contexts/automation/application/ports/out/PieceGateway'
import { CodeSandbox } from '@/contexts/automation/application/ports/out/CodeSandbox'
import { RunEventStore } from '@/contexts/automation/application/ports/out/RunEventStore'
import { Json } from '@/shared/domain/Json'
import { Result, ok, fail } from '@/shared/kernel/Result'

// --- fakes ----------------------------------------------------------------

class FakeFlowRepository implements FlowRepository {
  private readonly flows = new Map<string, Flow>()
  private counter = 0
  put(flow: Flow): void {
    this.flows.set(flow.id.value, flow)
  }
  nextRunId(): RunId {
    return RunId.of(`run-${++this.counter}`)
  }
  async findById(id: FlowId): Promise<Flow | null> {
    return this.flows.get(id.value) ?? null
  }
  async save(flow: Flow): Promise<void> {
    this.flows.set(flow.id.value, flow)
  }
}

class FakePieceGateway implements PieceGateway {
  constructor(private readonly responder: () => Result<Json>) {}
  async invoke(): Promise<Result<Json>> {
    return this.responder()
  }
}

class FakeCodeSandbox implements CodeSandbox {
  async run(): Promise<Result<Json>> {
    return ok(null)
  }
}

class InMemoryStore implements RunEventStore {
  private readonly logs = new Map<string, RunEvent[]>()
  async append(runId: string, event: RunEvent): Promise<void> {
    const log = this.logs.get(runId) ?? []
    log.push(event)
    this.logs.set(runId, log)
  }
  async load(runId: string): Promise<RunEvent[]> {
    return [...(this.logs.get(runId) ?? [])]
  }
}

const flowOf = (id: string): Flow => {
  const steps: Step[] = [
    { id: 'a', type: 'piece', pieceId: 'p', action: 'x', input: {}, next: 'c' },
    { id: 'c', type: 'complete', output: '{{a.value}}' },
  ]
  const r = Flow.create(FlowId.of(id), 'demo', 'a', steps)
  if (!r.ok) throw new Error(r.error)
  return r.value
}

const serviceWith = (repo: FlowRepository, piece: () => Result<Json>): StartFlowService => {
  const interpreter = new FlowInterpreter(new FakePieceGateway(piece), new FakeCodeSandbox(), new InMemoryStore())
  return new StartFlowService(repo, interpreter)
}

describe('StartFlowService', () => {
  it('fails when the flow does not exist', async () => {
    const svc = serviceWith(new FakeFlowRepository(), () => ok({ value: 'x' }))
    const r = await svc.execute({ flowId: 'missing', input: {} })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('StartFlow: flow not found')
  })

  it('runs the flow to completion and returns the run id, status and output', async () => {
    const repo = new FakeFlowRepository()
    repo.put(flowOf('flow-1'))
    const svc = serviceWith(repo, () => ok({ value: 'hello' }))

    const r = await svc.execute({ flowId: 'flow-1', input: { seed: 1 } })

    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value).toEqual({ runId: 'run-1', status: 'completed', output: 'hello' })
  })

  it('propagates a run failure as a Result failure', async () => {
    const repo = new FakeFlowRepository()
    repo.put(flowOf('flow-1'))
    const svc = serviceWith(repo, () => fail('piece exploded'))

    const r = await svc.execute({ flowId: 'flow-1', input: {} })

    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('piece exploded')
  })
})
