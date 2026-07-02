import { randomUUID } from 'node:crypto'
import { FlowRepository } from '@/contexts/automation/application/ports/out/FlowRepository'
import { Flow } from '@/contexts/automation/domain/Flow'
import { FlowId, RunId } from '@/contexts/automation/domain/ids'

export class InMemoryFlowRepository implements FlowRepository {
  private readonly flows = new Map<string, Flow>()

  nextRunId(): RunId {
    return RunId.of(randomUUID())
  }

  async findById(id: FlowId): Promise<Flow | null> {
    return this.flows.get(id.value) ?? null
  }

  async save(flow: Flow): Promise<void> {
    this.flows.set(flow.id.value, flow)
  }
}
