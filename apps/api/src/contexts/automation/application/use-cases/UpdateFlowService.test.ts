import { describe, it, expect } from 'vitest'
import { UpdateFlowService } from '@/contexts/automation/application/use-cases/UpdateFlowService'
import { TriggerLifecycleService } from '@/contexts/automation/application/use-cases/TriggerLifecycleService'
import { InMemoryFlowAggregateRepository } from '@/contexts/automation/adapters/out/persistence/InMemoryFlowAggregateRepository'
import { InMemoryFlowVersionRepository } from '@/contexts/automation/adapters/out/persistence/InMemoryFlowVersionRepository'
import { InMemoryScheduler } from '@/contexts/automation/adapters/out/scheduler/InMemoryScheduler'
import { StubTriggerRegistry } from '@/contexts/automation/adapters/out/trigger/StubTriggerRegistry'
import { Flow } from '@/contexts/automation/domain/FlowAggregate'
import { FlowVersion } from '@/contexts/automation/domain/FlowVersion'
import { FlowId, FlowVersionId } from '@/contexts/automation/domain/ids'

const NOW = new Date(0)
const fakeClock = { now: () => NOW }

interface Wiring {
  flows: InMemoryFlowAggregateRepository
  versions: InMemoryFlowVersionRepository
  scheduler: InMemoryScheduler
  svc: UpdateFlowService
}

const wire = (): Wiring => {
  const flows = new InMemoryFlowAggregateRepository()
  const versions = new InMemoryFlowVersionRepository()
  const scheduler = new InMemoryScheduler()
  const lifecycle = new TriggerLifecycleService(flows, versions, scheduler, new StubTriggerRegistry())
  return { flows, versions, scheduler, svc: new UpdateFlowService(flows, lifecycle, fakeClock) }
}

const scheduleTrigger = (cron = '*/5 * * * *'): string =>
  JSON.stringify({
    name: 'trigger',
    displayName: 'Trigger',
    type: 'SCHEDULE',
    valid: true,
    settings: { input: { cronExpression: cron } },
  })

const publishedFlow = async (w: Wiring, flowId: string): Promise<void> => {
  const flow = Flow.create({ id: FlowId.of(flowId), createdBy: null, now: NOW })
  const version = FlowVersion.createDraft({
    id: FlowVersionId.of(`${flowId}-v1`),
    flowId: FlowId.of(flowId),
    displayName: 'v1',
    triggerRaw: scheduleTrigger(),
    valid: true,
    now: NOW,
  })
  version.lock(NOW)
  await w.versions.save(version)
  flow.publish(version.id.value, NOW)
  await w.flows.save(flow)
}

describe('UpdateFlowService', () => {
  it('fails when the flow does not exist', async () => {
    const w = wire()
    const r = await w.svc.execute({ id: 'missing', status: 'enabled' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('UpdateFlow: flow not found')
  })

  it('enables the flow and drives the trigger lifecycle (schedules polling)', async () => {
    const w = wire()
    await publishedFlow(w, 'flow-1')

    const r = await w.svc.execute({ id: 'flow-1', status: 'enabled' })
    expect(r.ok).toBe(true)
    expect((await w.flows.findById(FlowId.of('flow-1')))!.status).toBe('enabled')
    // Lifecycle registered the SCHEDULE trigger's poll job.
    expect(w.scheduler.polls.get('flow-1')).toBe('*/5 * * * *')
  })

  it('disables the flow and unschedules its poll job', async () => {
    const w = wire()
    await publishedFlow(w, 'flow-1')
    await w.svc.execute({ id: 'flow-1', status: 'enabled' })

    const r = await w.svc.execute({ id: 'flow-1', status: 'disabled' })
    expect(r.ok).toBe(true)
    expect((await w.flows.findById(FlowId.of('flow-1')))!.status).toBe('disabled')
    expect(w.scheduler.polls.has('flow-1')).toBe(false)
  })

  it('moves the flow to a folder without touching status', async () => {
    const w = wire()
    await w.flows.save(Flow.create({ id: FlowId.of('flow-1'), createdBy: null, now: NOW }))

    const r = await w.svc.execute({ id: 'flow-1', folderId: 'folder-9' })
    expect(r.ok).toBe(true)
    const flow = await w.flows.findById(FlowId.of('flow-1'))
    expect(flow!.folderId).toBe('folder-9')
    expect(flow!.status).toBe('disabled')
  })
})
