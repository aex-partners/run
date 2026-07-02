import { describe, it, expect } from 'vitest'
import { PublishVersionService } from '@/contexts/automation/application/use-cases/PublishVersionService'
import { InMemoryFlowAggregateRepository } from '@/contexts/automation/adapters/out/persistence/InMemoryFlowAggregateRepository'
import { InMemoryFlowVersionRepository } from '@/contexts/automation/adapters/out/persistence/InMemoryFlowVersionRepository'
import { Flow } from '@/contexts/automation/domain/FlowAggregate'
import { FlowVersion } from '@/contexts/automation/domain/FlowVersion'
import { FlowId, FlowVersionId } from '@/contexts/automation/domain/ids'
import { PublishVersionError } from '@/contexts/automation/application/ports/in/PublishVersion'

const NOW = new Date(0)
const fakeClock = { now: () => NOW }

const webhookTrigger = JSON.stringify({
  name: 'trigger',
  displayName: 'Trigger',
  type: 'WEBHOOK',
  valid: true,
  settings: {},
})

const emptyTrigger = JSON.stringify({
  name: 'trigger',
  displayName: 'Trigger',
  type: 'EMPTY',
  valid: true,
  settings: {},
})

interface Wiring {
  flows: InMemoryFlowAggregateRepository
  versions: InMemoryFlowVersionRepository
  svc: PublishVersionService
}

const wire = (): Wiring => {
  const flows = new InMemoryFlowAggregateRepository()
  const versions = new InMemoryFlowVersionRepository()
  return { flows, versions, svc: new PublishVersionService(flows, versions, fakeClock) }
}

const seedDraft = async (w: Wiring, flowId: string, versionId: string, triggerRaw: string): Promise<void> => {
  await w.flows.save(Flow.create({ id: FlowId.of(flowId), createdBy: null, now: NOW }))
  await w.versions.save(
    FlowVersion.createDraft({
      id: FlowVersionId.of(versionId),
      flowId: FlowId.of(flowId),
      displayName: 'v1',
      triggerRaw,
      valid: false,
      now: NOW,
    }),
  )
}

describe('PublishVersionService', () => {
  it('fails when the version does not belong to the flow', async () => {
    const w = wire()
    await seedDraft(w, 'flow-1', 'ver-1', webhookTrigger)
    const r = await w.svc.execute({ flowId: 'other-flow', versionId: 'ver-1' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('PublishVersion: version not found for this flow')
  })

  it('fails with structured validation issues when the flow is not publishable', async () => {
    const w = wire()
    await seedDraft(w, 'flow-1', 'ver-1', emptyTrigger)
    const r = await w.svc.execute({ flowId: 'flow-1', versionId: 'ver-1' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    const err = r.error as PublishVersionError
    expect(err.message).toBe('Flow is not valid and cannot be published.')
    expect(err.errors.map((e) => e.code)).toContain('EMPTY_TRIGGER')
  })

  it('fails when the stored trigger is not valid JSON', async () => {
    const w = wire()
    await seedDraft(w, 'flow-1', 'ver-1', '{broken')
    const r = await w.svc.execute({ flowId: 'flow-1', versionId: 'ver-1' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('FlowVersion: trigger is not valid JSON')
  })

  it('locks the version and marks it as the flow published version', async () => {
    const w = wire()
    await seedDraft(w, 'flow-1', 'ver-1', webhookTrigger)
    const r = await w.svc.execute({ flowId: 'flow-1', versionId: 'ver-1' })
    expect(r.ok).toBe(true)

    const version = await w.versions.findById(FlowVersionId.of('ver-1'))
    expect(version!.isLocked()).toBe(true)
    const flow = await w.flows.findById(FlowId.of('flow-1'))
    expect(flow!.publishedVersionId).toBe('ver-1')
  })
})
