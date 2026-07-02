import { describe, it, expect } from 'vitest'
import { TriggerFlowService } from '@/contexts/automation/application/use-cases/TriggerFlowService'
import { InMemoryFlowAggregateRepository } from '@/contexts/automation/adapters/out/persistence/InMemoryFlowAggregateRepository'
import { InMemoryFlowVersionRepository } from '@/contexts/automation/adapters/out/persistence/InMemoryFlowVersionRepository'
import { InMemoryFlowRunRepository } from '@/contexts/automation/adapters/out/persistence/InMemoryFlowRunRepository'
import { InMemoryScheduler } from '@/contexts/automation/adapters/out/scheduler/InMemoryScheduler'
import { Flow } from '@/contexts/automation/domain/FlowAggregate'
import { FlowVersion } from '@/contexts/automation/domain/FlowVersion'
import { FlowRunId, FlowId, FlowVersionId } from '@/contexts/automation/domain/ids'

const NOW = new Date(0)
const fakeClock = { now: () => NOW }

const triggerRaw = JSON.stringify({
  name: 'trigger',
  displayName: 'Trigger',
  type: 'WEBHOOK',
  valid: true,
  settings: {},
})

interface Wiring {
  flows: InMemoryFlowAggregateRepository
  versions: InMemoryFlowVersionRepository
  runs: InMemoryFlowRunRepository
  scheduler: InMemoryScheduler
  svc: TriggerFlowService
}

const wire = (): Wiring => {
  const flows = new InMemoryFlowAggregateRepository()
  const versions = new InMemoryFlowVersionRepository()
  const runs = new InMemoryFlowRunRepository()
  const scheduler = new InMemoryScheduler()
  return { flows, versions, runs, scheduler, svc: new TriggerFlowService(flows, versions, runs, scheduler, fakeClock) }
}

const saveVersion = async (w: Wiring, flowId: string, versionId: string): Promise<void> => {
  await w.versions.save(
    FlowVersion.createDraft({
      id: FlowVersionId.of(versionId),
      flowId: FlowId.of(flowId),
      displayName: 'v1',
      triggerRaw,
      valid: true,
      now: NOW,
    }),
  )
}

describe('TriggerFlowService', () => {
  it('fails when the flow does not exist', async () => {
    const w = wire()
    const r = await w.svc.execute({ flowId: 'missing', triggeredBy: 'u1' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('TriggerFlow: flow not found')
  })

  it('fails when the flow has no versions and is not published', async () => {
    const w = wire()
    await w.flows.save(Flow.create({ id: FlowId.of('flow-1'), createdBy: null, now: NOW }))
    const r = await w.svc.execute({ flowId: 'flow-1', triggeredBy: 'u1' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('TriggerFlow: flow has no versions')
  })

  it('runs the published version when one is set, and enqueues the run', async () => {
    const w = wire()
    const flow = Flow.create({ id: FlowId.of('flow-1'), createdBy: null, now: NOW })
    flow.publish('ver-published', NOW)
    await w.flows.save(flow)
    await saveVersion(w, 'flow-1', 'ver-published')

    const r = await w.svc.execute({ flowId: 'flow-1', triggeredBy: 'u1' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const run = await w.runs.findById(FlowRunId.of(r.value.runId))
    expect(run!.flowVersionId!.value).toBe('ver-published')
    expect(run!.status).toBe('pending')
    expect(w.scheduler.enqueued).toEqual([{ runId: r.value.runId, delayMs: undefined }])
  })

  it('falls back to the latest version when nothing is published', async () => {
    const w = wire()
    await w.flows.save(Flow.create({ id: FlowId.of('flow-1'), createdBy: null, now: NOW }))
    await saveVersion(w, 'flow-1', 'ver-latest')

    const r = await w.svc.execute({ flowId: 'flow-1', triggeredBy: 'u1' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const run = await w.runs.findById(FlowRunId.of(r.value.runId))
    expect(run!.flowVersionId!.value).toBe('ver-latest')
  })

  it('serializes a provided trigger payload onto the run', async () => {
    const w = wire()
    await w.flows.save(Flow.create({ id: FlowId.of('flow-1'), createdBy: null, now: NOW }))
    await saveVersion(w, 'flow-1', 'ver-1')

    const r = await w.svc.execute({ flowId: 'flow-1', triggeredBy: 'u1', triggerPayload: { hello: 'world' } })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const run = await w.runs.findById(FlowRunId.of(r.value.runId))
    expect(run!.triggerPayloadRaw).toBe(JSON.stringify({ hello: 'world' }))
  })

  it('stores a null payload when none is provided', async () => {
    const w = wire()
    await w.flows.save(Flow.create({ id: FlowId.of('flow-1'), createdBy: null, now: NOW }))
    await saveVersion(w, 'flow-1', 'ver-1')

    const r = await w.svc.execute({ flowId: 'flow-1', triggeredBy: null })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const run = await w.runs.findById(FlowRunId.of(r.value.runId))
    expect(run!.triggerPayloadRaw).toBeNull()
  })
})
