import { describe, it, expect } from 'vitest'
import { MoveFlowService } from '@/contexts/automation/application/use-cases/MoveFlowService'
import { InMemoryFlowAggregateRepository } from '@/contexts/automation/adapters/out/persistence/InMemoryFlowAggregateRepository'
import { InMemoryFlowFolderRepository } from '@/contexts/automation/adapters/out/persistence/InMemoryFlowFolderRepository'
import { Flow } from '@/contexts/automation/domain/FlowAggregate'
import { FlowFolder } from '@/contexts/automation/domain/FlowFolder'
import { FlowId, FlowFolderId } from '@/contexts/automation/domain/ids'

const fakeClock = { now: () => new Date(0) }

const seededFlow = async (flows: InMemoryFlowAggregateRepository, id: string): Promise<void> => {
  await flows.save(Flow.create({ id: FlowId.of(id), createdBy: null, now: new Date(0) }))
}

describe('MoveFlowService', () => {
  it('fails when the flow does not exist', async () => {
    const svc = new MoveFlowService(new InMemoryFlowAggregateRepository(), new InMemoryFlowFolderRepository(), fakeClock)
    const r = await svc.execute({ flowId: 'missing', folderId: null })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('MoveFlow: flow not found')
  })

  it('fails when the target folder does not exist', async () => {
    const flows = new InMemoryFlowAggregateRepository()
    await seededFlow(flows, 'flow-1')
    const svc = new MoveFlowService(flows, new InMemoryFlowFolderRepository(), fakeClock)

    const r = await svc.execute({ flowId: 'flow-1', folderId: 'nope' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('MoveFlow: folder not found')
  })

  it('moves a flow into an existing folder', async () => {
    const flows = new InMemoryFlowAggregateRepository()
    const folders = new InMemoryFlowFolderRepository()
    await seededFlow(flows, 'flow-1')
    await folders.save(FlowFolder.create({ id: FlowFolderId.of('f-1'), displayName: 'F', now: new Date(0) }))
    const svc = new MoveFlowService(flows, folders, fakeClock)

    const r = await svc.execute({ flowId: 'flow-1', folderId: 'f-1' })
    expect(r.ok).toBe(true)
    expect((await flows.findById(FlowId.of('flow-1')))!.folderId).toBe('f-1')
  })

  it('moves a flow to the root with a null folder (no folder lookup)', async () => {
    const flows = new InMemoryFlowAggregateRepository()
    await seededFlow(flows, 'flow-1')
    const svc = new MoveFlowService(flows, new InMemoryFlowFolderRepository(), fakeClock)

    const r = await svc.execute({ flowId: 'flow-1', folderId: null })
    expect(r.ok).toBe(true)
    expect((await flows.findById(FlowId.of('flow-1')))!.folderId).toBeNull()
  })
})
