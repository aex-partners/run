import { describe, it, expect } from 'vitest'
import { HandleWebhookService } from '@/contexts/automation/application/use-cases/HandleWebhookService'
import { InMemoryFlowAggregateRepository } from '@/contexts/automation/adapters/out/persistence/InMemoryFlowAggregateRepository'
import { InMemoryFlowVersionRepository } from '@/contexts/automation/adapters/out/persistence/InMemoryFlowVersionRepository'
import { InMemoryFlowRunRepository } from '@/contexts/automation/adapters/out/persistence/InMemoryFlowRunRepository'
import { InMemoryScheduler } from '@/contexts/automation/adapters/out/scheduler/InMemoryScheduler'
import { Flow } from '@/contexts/automation/domain/FlowAggregate'
import { FlowVersion } from '@/contexts/automation/domain/FlowVersion'
import { FlowRunId, FlowId, FlowVersionId } from '@/contexts/automation/domain/ids'
import { WebhookPayload } from '@/contexts/automation/application/ports/in/HandleWebhook'

const NOW = new Date(0)
const fakeClock = { now: () => NOW }

const webhookTrigger = JSON.stringify({
  name: 'trigger',
  displayName: 'Trigger',
  type: 'WEBHOOK',
  valid: true,
  settings: {},
})

const scheduleTrigger = JSON.stringify({
  name: 'trigger',
  displayName: 'Trigger',
  type: 'SCHEDULE',
  valid: true,
  settings: { input: { cronExpression: '*/5 * * * *' } },
})

const payload: WebhookPayload = { body: { a: 1 }, headers: {}, queryParams: {} }

interface Wiring {
  flows: InMemoryFlowAggregateRepository
  versions: InMemoryFlowVersionRepository
  runs: InMemoryFlowRunRepository
  scheduler: InMemoryScheduler
  svc: HandleWebhookService
}

const wire = (): Wiring => {
  const flows = new InMemoryFlowAggregateRepository()
  const versions = new InMemoryFlowVersionRepository()
  const runs = new InMemoryFlowRunRepository()
  const scheduler = new InMemoryScheduler()
  return { flows, versions, runs, scheduler, svc: new HandleWebhookService(flows, versions, runs, scheduler, fakeClock) }
}

// Builds a flow with the given enabled/published state and a published version trigger.
const seedFlow = async (
  w: Wiring,
  opts: { flowId: string; enabled?: boolean; publishedVersionId?: string | null; triggerRaw?: string },
): Promise<void> => {
  const flow = Flow.create({ id: FlowId.of(opts.flowId), createdBy: null, now: NOW })
  if (opts.publishedVersionId) flow.publish(opts.publishedVersionId, NOW)
  if (opts.enabled) flow.enable(NOW)
  await w.flows.save(flow)
  if (opts.publishedVersionId && opts.triggerRaw !== undefined) {
    await w.versions.save(
      FlowVersion.createDraft({
        id: FlowVersionId.of(opts.publishedVersionId),
        flowId: FlowId.of(opts.flowId),
        displayName: 'v1',
        triggerRaw: opts.triggerRaw,
        valid: true,
        now: NOW,
      }),
    )
  }
}

describe('HandleWebhookService', () => {
  it('returns 404 when the flow does not exist', async () => {
    const w = wire()
    const r = await w.svc.execute({ flowId: 'missing', payload })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toEqual({ error: 'Flow not found', status: 404 })
  })

  it('returns 400 when the flow is not enabled', async () => {
    const w = wire()
    await seedFlow(w, { flowId: 'flow-1', enabled: false, publishedVersionId: 'ver-1', triggerRaw: webhookTrigger })
    const r = await w.svc.execute({ flowId: 'flow-1', payload })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toEqual({ error: 'Flow is not enabled', status: 400 })
  })

  it('returns 400 when the flow has no published version', async () => {
    const w = wire()
    await seedFlow(w, { flowId: 'flow-1', enabled: true, publishedVersionId: null })
    const r = await w.svc.execute({ flowId: 'flow-1', payload })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toEqual({ error: 'Flow has no published version', status: 400 })
  })

  it('returns 404 when the published version is missing', async () => {
    const w = wire()
    // Published id set on the flow but no version row saved.
    const flow = Flow.create({ id: FlowId.of('flow-1'), createdBy: null, now: NOW })
    flow.publish('ver-1', NOW)
    flow.enable(NOW)
    await w.flows.save(flow)
    const r = await w.svc.execute({ flowId: 'flow-1', payload })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toEqual({ error: 'Published version not found', status: 404 })
  })

  it('returns 400 when the published trigger is not a webhook', async () => {
    const w = wire()
    await seedFlow(w, { flowId: 'flow-1', enabled: true, publishedVersionId: 'ver-1', triggerRaw: scheduleTrigger })
    const r = await w.svc.execute({ flowId: 'flow-1', payload })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toEqual({ error: 'Flow trigger is not a webhook', status: 400 })
  })

  it('returns 400 when the published trigger is invalid JSON', async () => {
    const w = wire()
    await seedFlow(w, { flowId: 'flow-1', enabled: true, publishedVersionId: 'ver-1', triggerRaw: '{broken' })
    const r = await w.svc.execute({ flowId: 'flow-1', payload })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toEqual({ error: 'Published version trigger is invalid', status: 400 })
  })

  it('creates a running run and enqueues it on a valid webhook delivery', async () => {
    const w = wire()
    await seedFlow(w, { flowId: 'flow-1', enabled: true, publishedVersionId: 'ver-1', triggerRaw: webhookTrigger })
    const r = await w.svc.execute({ flowId: 'flow-1', payload })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const run = await w.runs.findById(FlowRunId.of(r.value.runId))
    expect(run!.status).toBe('running')
    expect(run!.triggeredBy).toBe('webhook')
    expect(run!.triggerPayloadRaw).toBe(JSON.stringify(payload))
    expect(w.scheduler.enqueued).toEqual([{ runId: r.value.runId, delayMs: undefined }])
  })
})
