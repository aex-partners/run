import { describe, it, expect } from 'vitest'
import { RunFlowService } from '@/contexts/automation/application/use-cases/RunFlowService'
import { FlowEngineInterpreter } from '@/contexts/automation/application/use-cases/FlowEngineInterpreter'
import { InMemoryFlowRunRepository } from '@/contexts/automation/adapters/out/persistence/InMemoryFlowRunRepository'
import { InMemoryFlowVersionRepository } from '@/contexts/automation/adapters/out/persistence/InMemoryFlowVersionRepository'
import { InMemoryEngineEventStore } from '@/contexts/automation/adapters/out/persistence/InMemoryEngineEventStore'
import { EchoCodeSandbox } from '@/contexts/automation/adapters/out/sandbox/EchoCodeSandbox'
import { PieceGateway } from '@/contexts/automation/application/ports/out/PieceGateway'
import { FlowRun } from '@/contexts/automation/domain/FlowRun'
import { FlowVersion } from '@/contexts/automation/domain/FlowVersion'
import { FlowId, FlowRunId, FlowVersionId } from '@/contexts/automation/domain/ids'
import { Json } from '@/shared/domain/Json'
import { Result, ok, fail } from '@/shared/kernel/Result'

const NOW = new Date(0)
const fakeClock = { now: () => NOW }

class FakePieceGateway implements PieceGateway {
  constructor(private readonly responder: () => Result<Json>) {}
  async invoke(): Promise<Result<Json>> {
    return this.responder()
  }
}

const triggerWithPiece = JSON.stringify({
  name: 'trigger',
  displayName: 'Trigger',
  type: 'WEBHOOK',
  valid: true,
  settings: {},
  nextAction: {
    name: 'step_1',
    displayName: 'step_1',
    valid: true,
    type: 'PIECE',
    settings: { pieceName: 'http', actionName: 'get', input: {} },
  },
})

interface Wiring {
  runs: InMemoryFlowRunRepository
  versions: InMemoryFlowVersionRepository
  svc: RunFlowService
}

const wire = (piece: () => Result<Json>): Wiring => {
  const runs = new InMemoryFlowRunRepository()
  const versions = new InMemoryFlowVersionRepository()
  const interpreter = new FlowEngineInterpreter(new FakePieceGateway(piece), new EchoCodeSandbox(), new InMemoryEngineEventStore())
  return { runs, versions, svc: new RunFlowService(runs, versions, interpreter, fakeClock) }
}

const saveVersion = async (w: Wiring, flowId: string, versionId: string, raw: string): Promise<void> => {
  await w.versions.save(
    FlowVersion.createDraft({
      id: FlowVersionId.of(versionId),
      flowId: FlowId.of(flowId),
      displayName: 'v1',
      triggerRaw: raw,
      valid: true,
      now: NOW,
    }),
  )
}

const savePendingRun = async (w: Wiring, runId: string, flowId: string, versionId: string | null): Promise<void> => {
  await w.runs.save(
    FlowRun.createPending({
      id: FlowRunId.of(runId),
      flowId: FlowId.of(flowId),
      flowVersionId: versionId === null ? null : FlowVersionId.of(versionId),
      triggeredBy: 'test',
      triggerPayloadRaw: null,
      now: NOW,
    }),
  )
}

describe('RunFlowService', () => {
  it('fails when the run does not exist', async () => {
    const w = wire(() => ok({}))
    const r = await w.svc.execute({ runId: 'missing' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('RunFlow: run not found')
  })

  it('skips a run that is already terminal', async () => {
    const w = wire(() => ok({}))
    await w.runs.save(
      FlowRun.rehydrate({
        id: FlowRunId.of('run-1'),
        flowId: FlowId.of('flow-1'),
        flowVersionId: FlowVersionId.of('ver-1'),
        status: 'succeeded',
        triggeredBy: 'test',
        triggerPayloadRaw: null,
        stepsRaw: '{}',
        duration: 1,
        tagsRaw: '[]',
        error: null,
        startedAt: NOW,
        completedAt: NOW,
        createdAt: NOW,
      }),
    )
    const r = await w.svc.execute({ runId: 'run-1' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.status).toBe('skipped')
  })

  it('fails when the run has no version', async () => {
    const w = wire(() => ok({}))
    await savePendingRun(w, 'run-1', 'flow-1', null)
    const r = await w.svc.execute({ runId: 'run-1' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('RunFlow: run has no version')
  })

  it('fails when the flow version is not found', async () => {
    const w = wire(() => ok({}))
    await savePendingRun(w, 'run-1', 'flow-1', 'ver-1')
    const r = await w.svc.execute({ runId: 'run-1' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('RunFlow: flow version not found')
  })

  it('fails when the version trigger is not valid JSON', async () => {
    const w = wire(() => ok({}))
    await saveVersion(w, 'flow-1', 'ver-1', '{broken')
    await savePendingRun(w, 'run-1', 'flow-1', 'ver-1')
    const r = await w.svc.execute({ runId: 'run-1' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('FlowVersion: trigger is not valid JSON')
  })

  it('runs to success and persists the succeeded run', async () => {
    const w = wire(() => ok({ tone: 'ok' }))
    await saveVersion(w, 'flow-1', 'ver-1', triggerWithPiece)
    await savePendingRun(w, 'run-1', 'flow-1', 'ver-1')

    const r = await w.svc.execute({ runId: 'run-1' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.status).toBe('succeeded')
    const run = await w.runs.findById(FlowRunId.of('run-1'))
    expect(run!.status).toBe('succeeded')
    expect(run!.startedAt).toEqual(NOW)
  })

  it('records a failed run when a step fails', async () => {
    const w = wire(() => fail('upstream 500'))
    await saveVersion(w, 'flow-1', 'ver-1', triggerWithPiece)
    await savePendingRun(w, 'run-1', 'flow-1', 'ver-1')

    const r = await w.svc.execute({ runId: 'run-1' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value).toMatchObject({ status: 'failed', error: 'upstream 500' })
    const run = await w.runs.findById(FlowRunId.of('run-1'))
    expect(run!.status).toBe('failed')
    expect(run!.error).toBe('upstream 500')
  })
})
