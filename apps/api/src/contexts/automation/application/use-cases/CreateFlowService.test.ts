import { describe, it, expect } from 'vitest'
import { CreateFlowService } from '@/contexts/automation/application/use-cases/CreateFlowService'
import { InMemoryFlowAggregateRepository } from '@/contexts/automation/adapters/out/persistence/InMemoryFlowAggregateRepository'
import { InMemoryFlowVersionRepository } from '@/contexts/automation/adapters/out/persistence/InMemoryFlowVersionRepository'
import { FlowId, FlowVersionId } from '@/contexts/automation/domain/ids'

const fakeClock = { now: () => new Date(0) }

describe('CreateFlowService', () => {
  it('creates a disabled flow plus an initial empty-trigger draft', async () => {
    const flows = new InMemoryFlowAggregateRepository()
    const versions = new InMemoryFlowVersionRepository()
    const svc = new CreateFlowService(flows, versions, fakeClock)

    const r = await svc.execute({ displayName: 'My Flow', createdBy: 'u1' })
    expect(r.ok).toBe(true)
    if (!r.ok) return

    const flow = await flows.findById(FlowId.of(r.value.id))
    expect(flow).not.toBeNull()
    expect(flow!.status).toBe('disabled')
    expect(flow!.createdBy).toBe('u1')

    const version = await versions.findById(FlowVersionId.of(r.value.versionId))
    expect(version).not.toBeNull()
    expect(version!.displayName).toBe('My Flow')
    expect(version!.isDraft()).toBe(true)
    // The default trigger is EMPTY and the draft starts invalid.
    expect(version!.valid).toBe(false)
    expect(JSON.parse(version!.triggerRaw)).toMatchObject({ type: 'EMPTY' })
    expect(version!.flowId.value).toBe(r.value.id)
  })

  it('accepts a null createdBy', async () => {
    const flows = new InMemoryFlowAggregateRepository()
    const versions = new InMemoryFlowVersionRepository()
    const svc = new CreateFlowService(flows, versions, fakeClock)

    const r = await svc.execute({ displayName: 'Anon', createdBy: null })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const flow = await flows.findById(FlowId.of(r.value.id))
    expect(flow!.createdBy).toBeNull()
  })
})
