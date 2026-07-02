import { describe, it, expect } from 'vitest'
import { TriggerLifecycleService } from '@/contexts/automation/application/use-cases/TriggerLifecycleService'
import { InMemoryFlowAggregateRepository } from '@/contexts/automation/adapters/out/persistence/InMemoryFlowAggregateRepository'
import { InMemoryFlowVersionRepository } from '@/contexts/automation/adapters/out/persistence/InMemoryFlowVersionRepository'
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
import { FlowId, FlowVersionId } from '@/contexts/automation/domain/ids'

const NOW = new Date(0)

// Records trigger lifecycle calls and lets each test pick what enable() returns.
class RecordingTriggerRegistry implements TriggerRegistry {
  readonly enabled: TriggerRef[] = []
  readonly disabled: TriggerRef[] = []
  constructor(
    private readonly enableResult: EnableResult = {},
    private readonly disableImpl: () => void = () => {},
  ) {}
  async enable(ref: TriggerRef): Promise<EnableResult> {
    this.enabled.push(ref)
    return this.enableResult
  }
  async disable(ref: TriggerRef): Promise<void> {
    this.disabled.push(ref)
    this.disableImpl()
  }
  async poll(_ref: TriggerRef): Promise<PollResult> {
    return { items: [] }
  }
}

const scheduleTrigger = (cron = '*/5 * * * *'): string =>
  JSON.stringify({
    name: 'trigger',
    displayName: 'Trigger',
    type: 'SCHEDULE',
    valid: true,
    settings: { input: { cronExpression: cron } },
  })

const pieceTrigger = (): string =>
  JSON.stringify({
    name: 'trigger',
    displayName: 'Trigger',
    type: 'PIECE',
    valid: true,
    settings: { pieceName: 'gmail', triggerName: 'new_email', input: { label: 'INBOX' } },
  })

// Wire a published flow whose published version carries the given trigger JSON.
const publishedFlow = async (
  flows: InMemoryFlowAggregateRepository,
  versions: InMemoryFlowVersionRepository,
  flowId: string,
  triggerRaw: string,
): Promise<void> => {
  const flow = Flow.create({ id: FlowId.of(flowId), createdBy: null, now: NOW })
  const version = FlowVersion.createDraft({
    id: FlowVersionId.of(`${flowId}-v1`),
    flowId: FlowId.of(flowId),
    displayName: 'v1',
    triggerRaw,
    valid: true,
    now: NOW,
  })
  version.lock(NOW)
  await versions.save(version)
  flow.publish(version.id.value, NOW)
  flow.enable(NOW)
  await flows.save(flow)
}

describe('TriggerLifecycleService.enable', () => {
  it('schedules polling for a cron (SCHEDULE) trigger', async () => {
    const flows = new InMemoryFlowAggregateRepository()
    const versions = new InMemoryFlowVersionRepository()
    const scheduler = new InMemoryScheduler()
    await publishedFlow(flows, versions, 'flow-1', scheduleTrigger('*/10 * * * *'))
    const svc = new TriggerLifecycleService(flows, versions, scheduler, new StubTriggerRegistry())

    await svc.enable(FlowId.of('flow-1'))
    expect(scheduler.polls.get('flow-1')).toBe('*/10 * * * *')
  })

  it('registers a piece trigger and schedules polling when the strategy is POLLING', async () => {
    const flows = new InMemoryFlowAggregateRepository()
    const versions = new InMemoryFlowVersionRepository()
    const scheduler = new InMemoryScheduler()
    const registry = new RecordingTriggerRegistry({ strategy: 'POLLING', scheduledCron: '0 * * * *' })
    await publishedFlow(flows, versions, 'flow-1', pieceTrigger())
    const svc = new TriggerLifecycleService(flows, versions, scheduler, registry)

    await svc.enable(FlowId.of('flow-1'))
    expect(registry.enabled).toHaveLength(1)
    expect(registry.enabled[0]).toMatchObject({ pieceName: 'gmail', triggerName: 'new_email' })
    expect(scheduler.polls.get('flow-1')).toBe('0 * * * *')
  })

  it('falls back to the default poll cron when a POLLING strategy declares none', async () => {
    const flows = new InMemoryFlowAggregateRepository()
    const versions = new InMemoryFlowVersionRepository()
    const scheduler = new InMemoryScheduler()
    const registry = new RecordingTriggerRegistry({ strategy: 'POLLING' })
    await publishedFlow(flows, versions, 'flow-1', pieceTrigger())
    const svc = new TriggerLifecycleService(flows, versions, scheduler, registry)

    await svc.enable(FlowId.of('flow-1'))
    expect(scheduler.polls.get('flow-1')).toBe('*/5 * * * *')
  })

  it('does not schedule polling for a non-POLLING (e.g. WEBHOOK) piece strategy', async () => {
    const flows = new InMemoryFlowAggregateRepository()
    const versions = new InMemoryFlowVersionRepository()
    const scheduler = new InMemoryScheduler()
    const registry = new RecordingTriggerRegistry({ strategy: 'WEBHOOK' })
    await publishedFlow(flows, versions, 'flow-1', pieceTrigger())
    const svc = new TriggerLifecycleService(flows, versions, scheduler, registry)

    await svc.enable(FlowId.of('flow-1'))
    expect(registry.enabled).toHaveLength(1)
    expect(scheduler.polls.has('flow-1')).toBe(false)
  })

  it('does nothing when the flow has no published version', async () => {
    const flows = new InMemoryFlowAggregateRepository()
    const versions = new InMemoryFlowVersionRepository()
    const scheduler = new InMemoryScheduler()
    await flows.save(Flow.create({ id: FlowId.of('flow-1'), createdBy: null, now: NOW }))
    const svc = new TriggerLifecycleService(flows, versions, scheduler, new StubTriggerRegistry())

    await svc.enable(FlowId.of('flow-1'))
    expect(scheduler.polls.size).toBe(0)
  })
})

describe('TriggerLifecycleService.disable', () => {
  it('unschedules polling for a cron trigger', async () => {
    const flows = new InMemoryFlowAggregateRepository()
    const versions = new InMemoryFlowVersionRepository()
    const scheduler = new InMemoryScheduler()
    await publishedFlow(flows, versions, 'flow-1', scheduleTrigger())
    scheduler.polls.set('flow-1', '*/5 * * * *')
    const svc = new TriggerLifecycleService(flows, versions, scheduler, new StubTriggerRegistry())

    await svc.disable(FlowId.of('flow-1'))
    expect(scheduler.polls.has('flow-1')).toBe(false)
  })

  it('tears down a piece trigger and unschedules polling', async () => {
    const flows = new InMemoryFlowAggregateRepository()
    const versions = new InMemoryFlowVersionRepository()
    const scheduler = new InMemoryScheduler()
    const registry = new RecordingTriggerRegistry()
    await publishedFlow(flows, versions, 'flow-1', pieceTrigger())
    scheduler.polls.set('flow-1', '*/5 * * * *')
    const svc = new TriggerLifecycleService(flows, versions, scheduler, registry)

    await svc.disable(FlowId.of('flow-1'))
    expect(registry.disabled).toHaveLength(1)
    expect(scheduler.polls.has('flow-1')).toBe(false)
  })

  it('swallows a failing teardown but still drops the poll job', async () => {
    const flows = new InMemoryFlowAggregateRepository()
    const versions = new InMemoryFlowVersionRepository()
    const scheduler = new InMemoryScheduler()
    const registry = new RecordingTriggerRegistry({}, () => {
      throw new Error('boom')
    })
    await publishedFlow(flows, versions, 'flow-1', pieceTrigger())
    scheduler.polls.set('flow-1', '*/5 * * * *')
    const svc = new TriggerLifecycleService(flows, versions, scheduler, registry)

    await svc.disable(FlowId.of('flow-1'))
    expect(scheduler.polls.has('flow-1')).toBe(false)
  })

  it('unschedules polling even when the flow has no published version', async () => {
    const flows = new InMemoryFlowAggregateRepository()
    const versions = new InMemoryFlowVersionRepository()
    const scheduler = new InMemoryScheduler()
    await flows.save(Flow.create({ id: FlowId.of('flow-1'), createdBy: null, now: NOW }))
    scheduler.polls.set('flow-1', '*/5 * * * *')
    const svc = new TriggerLifecycleService(flows, versions, scheduler, new StubTriggerRegistry())

    await svc.disable(FlowId.of('flow-1'))
    expect(scheduler.polls.has('flow-1')).toBe(false)
  })
})
