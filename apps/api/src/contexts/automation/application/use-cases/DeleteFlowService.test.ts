import { describe, it, expect } from 'vitest'
import { DeleteFlowService } from '@/contexts/automation/application/use-cases/DeleteFlowService'
import { InMemoryFlowAggregateRepository } from '@/contexts/automation/adapters/out/persistence/InMemoryFlowAggregateRepository'
import { Flow } from '@/contexts/automation/domain/FlowAggregate'
import { FlowId } from '@/contexts/automation/domain/ids'

describe('DeleteFlowService', () => {
  it('deletes an existing flow', async () => {
    const flows = new InMemoryFlowAggregateRepository()
    const flow = Flow.create({ id: FlowId.of('flow-1'), createdBy: null, now: new Date(0) })
    await flows.save(flow)
    const svc = new DeleteFlowService(flows)

    const r = await svc.execute({ id: 'flow-1' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.success).toBe(true)
    expect(await flows.findById(FlowId.of('flow-1'))).toBeNull()
  })

  it('is idempotent for a missing flow', async () => {
    const flows = new InMemoryFlowAggregateRepository()
    const svc = new DeleteFlowService(flows)
    const r = await svc.execute({ id: 'missing' })
    expect(r.ok).toBe(true)
  })
})
