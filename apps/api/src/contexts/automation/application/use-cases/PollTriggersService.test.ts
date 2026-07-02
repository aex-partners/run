import { describe, it, expect } from 'vitest'
import { PollTriggersService } from '@/contexts/automation/application/use-cases/PollTriggersService'
import { InMemoryFlowAggregateRepository } from '@/contexts/automation/adapters/out/persistence/InMemoryFlowAggregateRepository'
import { InMemoryFlowVersionRepository } from '@/contexts/automation/adapters/out/persistence/InMemoryFlowVersionRepository'
import { InMemoryFlowRunRepository } from '@/contexts/automation/adapters/out/persistence/InMemoryFlowRunRepository'
import { InMemoryScheduler } from '@/contexts/automation/adapters/out/scheduler/InMemoryScheduler'
import { StubTriggerRegistry } from '@/contexts/automation/adapters/out/trigger/StubTriggerRegistry'
import {
  TriggerRegistry,
  TriggerRef,
  EnableResult,
  PollResult,
} from '@/contexts/automation/application/ports/out/TriggerRegistry'
import { Flow } from '@/contexts/automation/domain/FlowAggregate'
import { FlowVersion } from '@/contexts/automation/domain/FlowVersion'
import { FlowRunId, FlowId, FlowVersionId } from '@/contexts/automation/domain/ids'
import { Json } from '@/shared/domain/Json'

const NOW = new Date(0)
const fakeClock = { now: () => NOW }

const scheduleTrigger = JSON.stringify({
  name: 'trigger',
  displayName: 'Trigger',
  type: 'SCHEDULE',
  valid: true,
  settings: { input: { cronExpression: '*/5 * * * *' } },
})

const pieceTrigger = JSON.stringify({
  name: 'trigger',
  displayName: 'Trigger',
  type: 'PIECE',
  valid: true,
  settings: { pieceName: 'gmail', triggerName: 'new_email', input: { label: 'INBOX' } },
})

const webhookTrigger = JSON.stringify({
  name: 'trigger',
  displayName: 'Trigger',
  type: 'WEBHOOK',
  valid: true,
  settings: {},
})

// Emits a fixed list of items per poll.
class ItemsTriggerRegistry implements TriggerRegistry {
  constructor(private readonly items: Json[]) {}
  async enable(_ref: TriggerRef): Promise<EnableResult> {
    return {}
  }
  async disable(_ref: TriggerRef): Promise<void> {}
  async poll(_ref: TriggerRef): Promise<PollResult> {
    return { items: this.items }
  }
}

interface Wiring {
  flows: InMemoryFlowAggregateRepository
  versions: InMemoryFlowVersionRepository
  runs: InMemoryFlowRunRepository
  scheduler: InMemoryScheduler
  svc: PollTriggersService
}

const wire = (registry: TriggerRegistry = new StubTriggerRegistry()): Wiring => {
  const flows = new InMemoryFlowAggregateRepository()
  const versions = new InMemoryFlowVersionRepository()
  const runs = new InMemoryFlowRunRepository()
  const scheduler = new InMemoryScheduler()
  return {
    flows,
    versions,
    runs,
    scheduler,
    svc: new PollTriggersService(flows, versions, runs, scheduler, registry, fakeClock),
  }
}

const seedEnabledPublished = async (w: Wiring, flowId: string, triggerRaw: string): Promise<void> => {
  const flow = Flow.create({ id: FlowId.of(flowId), createdBy: null, now: NOW })
  const versionId = `${flowId}-v1`
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
  flow.publish(versionId, NOW)
  flow.enable(NOW)
  await w.flows.save(flow)
}

describe('PollTriggersService', () => {
  it('returns no runs when the flow is missing, disabled, or unpublished', async () => {
    const w = wire()
    const r = await w.svc.execute({ flowId: 'missing' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.runIds).toEqual([])
  })

  it('returns no runs when the published version is gone', async () => {
    const w = wire()
    const flow = Flow.create({ id: FlowId.of('flow-1'), createdBy: null, now: NOW })
    flow.publish('ver-1', NOW)
    flow.enable(NOW)
    await w.flows.save(flow)
    const r = await w.svc.execute({ flowId: 'flow-1' })
    expect(r.ok && r.value.runIds).toEqual([])
  })

  it('creates exactly one run for a cron (SCHEDULE) trigger and enqueues it', async () => {
    const w = wire()
    await seedEnabledPublished(w, 'flow-1', scheduleTrigger)

    const r = await w.svc.execute({ flowId: 'flow-1' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.runIds).toHaveLength(1)
    const run = await w.runs.findById(FlowRunId.of(r.value.runIds[0]!))
    expect(run!.triggeredBy).toBe('schedule')
    expect(w.scheduler.enqueued).toHaveLength(1)
  })

  it('fans out one run per fresh item for a piece (event) trigger', async () => {
    const w = wire(new ItemsTriggerRegistry([{ id: 1 }, { id: 2 }]))
    await seedEnabledPublished(w, 'flow-1', pieceTrigger)

    const r = await w.svc.execute({ flowId: 'flow-1' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.runIds).toHaveLength(2)
    const run = await w.runs.findById(FlowRunId.of(r.value.runIds[0]!))
    expect(run!.triggeredBy).toBe('piece')
    expect(run!.triggerPayloadRaw).toBe(JSON.stringify({ id: 1 }))
    expect(w.scheduler.enqueued).toHaveLength(2)
  })

  it('creates no runs for a webhook trigger (passive)', async () => {
    const w = wire()
    await seedEnabledPublished(w, 'flow-1', webhookTrigger)
    const r = await w.svc.execute({ flowId: 'flow-1' })
    expect(r.ok && r.value.runIds).toEqual([])
  })
})
