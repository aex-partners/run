import { describe, it, expect } from 'vitest'
import { RestoreVersionService } from '@/contexts/automation/application/use-cases/RestoreVersionService'
import { InMemoryFlowAggregateRepository } from '@/contexts/automation/adapters/out/persistence/InMemoryFlowAggregateRepository'
import { InMemoryFlowVersionRepository } from '@/contexts/automation/adapters/out/persistence/InMemoryFlowVersionRepository'
import { Flow } from '@/contexts/automation/domain/FlowAggregate'
import { FlowVersion } from '@/contexts/automation/domain/FlowVersion'
import { FlowId, FlowVersionId } from '@/contexts/automation/domain/ids'

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
  svc: RestoreVersionService
}

const wire = (): Wiring => {
  const flows = new InMemoryFlowAggregateRepository()
  const versions = new InMemoryFlowVersionRepository()
  return { flows, versions, svc: new RestoreVersionService(flows, versions, fakeClock) }
}

const lockedVersion = (flowId: string, versionId: string): FlowVersion => {
  const v = FlowVersion.createDraft({
    id: FlowVersionId.of(versionId),
    flowId: FlowId.of(flowId),
    displayName: 'snapshot',
    triggerRaw,
    valid: true,
    schemaVersion: 'v2',
    now: NOW,
  })
  v.lock(NOW)
  return v
}

describe('RestoreVersionService', () => {
  it('fails when the flow does not exist', async () => {
    const w = wire()
    const r = await w.svc.execute({ flowId: 'missing', versionId: 'ver-1' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('RestoreVersion: flow not found')
  })

  it('fails when the source version is not found for the flow', async () => {
    const w = wire()
    await w.flows.save(Flow.create({ id: FlowId.of('flow-1'), createdBy: null, now: NOW }))
    const r = await w.svc.execute({ flowId: 'flow-1', versionId: 'nope' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('RestoreVersion: version not found')
  })

  it('only restores from a locked version', async () => {
    const w = wire()
    await w.flows.save(Flow.create({ id: FlowId.of('flow-1'), createdBy: null, now: NOW }))
    await w.versions.save(
      FlowVersion.createDraft({
        id: FlowVersionId.of('ver-1'),
        flowId: FlowId.of('flow-1'),
        displayName: 'draft',
        triggerRaw,
        valid: false,
        now: NOW,
      }),
    )
    const r = await w.svc.execute({ flowId: 'flow-1', versionId: 'ver-1' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('RestoreVersion: can only restore from a locked version')
  })

  it('clones a locked version into a fresh draft, replacing any existing draft', async () => {
    const w = wire()
    await w.flows.save(Flow.create({ id: FlowId.of('flow-1'), createdBy: null, now: NOW }))
    await w.versions.save(lockedVersion('flow-1', 'locked-1'))
    // A pre-existing draft that must be deleted on restore.
    await w.versions.save(
      FlowVersion.createDraft({
        id: FlowVersionId.of('old-draft'),
        flowId: FlowId.of('flow-1'),
        displayName: 'old draft',
        triggerRaw,
        valid: false,
        now: NOW,
      }),
    )

    const r = await w.svc.execute({ flowId: 'flow-1', versionId: 'locked-1' })
    expect(r.ok).toBe(true)
    if (!r.ok) return

    expect(await w.versions.findById(FlowVersionId.of('old-draft'))).toBeNull()
    const draft = await w.versions.findDraft(FlowId.of('flow-1'))
    expect(draft!.id.value).toBe(r.value.versionId)
    expect(draft!.isDraft()).toBe(true)
    expect(draft!.valid).toBe(false)
    // Source content is carried over.
    expect(draft!.displayName).toBe('snapshot')
    expect(draft!.triggerRaw).toBe(triggerRaw)
    expect(draft!.schemaVersion).toBe('v2')
  })
})
