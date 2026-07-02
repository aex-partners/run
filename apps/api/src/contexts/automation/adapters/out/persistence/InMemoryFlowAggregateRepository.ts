import { randomUUID } from 'node:crypto'
import { FlowAggregateRepository } from '@/contexts/automation/application/ports/out/FlowAggregateRepository'
import { Flow } from '@/contexts/automation/domain/FlowAggregate'
import { FlowId } from '@/contexts/automation/domain/ids'

// In-memory test double for the AEX `flows` aggregate repository.
export class InMemoryFlowAggregateRepository implements FlowAggregateRepository {
  private readonly flows = new Map<string, Flow>()

  nextId(): FlowId {
    return FlowId.of(randomUUID())
  }

  async findById(id: FlowId): Promise<Flow | null> {
    return this.flows.get(id.value) ?? null
  }

  async save(flow: Flow): Promise<void> {
    this.flows.set(flow.id.value, flow)
  }

  async delete(id: FlowId): Promise<void> {
    this.flows.delete(id.value)
  }
}
