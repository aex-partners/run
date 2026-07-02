import { Flow } from '@/contexts/automation/domain/FlowAggregate'
import { FlowId } from '@/contexts/automation/domain/ids'

// Driven port for the AEX `flows` aggregate (the rich engine flow, distinct from
// the skeleton's toy FlowRepository). `save` is an upsert.
export interface FlowAggregateRepository {
  nextId(): FlowId
  findById(id: FlowId): Promise<Flow | null>
  save(flow: Flow): Promise<void>
  delete(id: FlowId): Promise<void>
}
