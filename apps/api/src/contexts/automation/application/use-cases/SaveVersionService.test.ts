import { describe, it, expect } from 'vitest'
import { SaveVersionService } from '@/contexts/automation/application/use-cases/SaveVersionService'
import { InMemoryFlowVersionRepository } from '@/contexts/automation/adapters/out/persistence/InMemoryFlowVersionRepository'
import { FlowId } from '@/contexts/automation/domain/ids'

const fakeClock = { now: () => new Date(0) }

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

describe('SaveVersionService', () => {
  it('fails when the trigger is not valid JSON', async () => {
    const svc = new SaveVersionService(new InMemoryFlowVersionRepository(), fakeClock)
    const r = await svc.execute({ flowId: 'flow-1', displayName: 'v1', trigger: '{not json' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('SaveVersion: trigger is not valid JSON')
  })

  it('creates a new draft when none exists, computing validity in save mode', async () => {
    const versions = new InMemoryFlowVersionRepository()
    const svc = new SaveVersionService(versions, fakeClock)

    const r = await svc.execute({ flowId: 'flow-1', displayName: 'v1', trigger: webhookTrigger })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const draft = await versions.findDraft(FlowId.of('flow-1'))
    expect(draft).not.toBeNull()
    expect(draft!.id.value).toBe(r.value.versionId)
    expect(draft!.displayName).toBe('v1')
    // A WEBHOOK trigger has no validation errors -> valid in save mode.
    expect(draft!.valid).toBe(true)
  })

  it('marks an EMPTY trigger draft valid in save mode (empty trigger is only a warning)', async () => {
    const versions = new InMemoryFlowVersionRepository()
    const svc = new SaveVersionService(versions, fakeClock)
    const r = await svc.execute({ flowId: 'flow-1', displayName: 'v1', trigger: emptyTrigger })
    expect(r.ok).toBe(true)
    const draft = await versions.findDraft(FlowId.of('flow-1'))
    expect(draft!.valid).toBe(true)
  })

  it('upserts the existing draft in place rather than creating a second one', async () => {
    const versions = new InMemoryFlowVersionRepository()
    const svc = new SaveVersionService(versions, fakeClock)

    const first = await svc.execute({ flowId: 'flow-1', displayName: 'v1', trigger: webhookTrigger })
    if (!first.ok) return
    const second = await svc.execute({ flowId: 'flow-1', displayName: 'renamed', trigger: webhookTrigger })
    expect(second.ok).toBe(true)
    if (!second.ok) return

    // Same draft id reused.
    expect(second.value.versionId).toBe(first.value.versionId)
    const all = await versions.listForFlow(FlowId.of('flow-1'))
    expect(all).toHaveLength(1)
    expect(all[0]!.displayName).toBe('renamed')
  })
})
