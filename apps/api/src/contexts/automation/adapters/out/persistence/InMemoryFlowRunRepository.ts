import { randomUUID } from 'node:crypto'
import { FlowRunRepository } from '@/contexts/automation/application/ports/out/FlowRunRepository'
import { FlowRun } from '@/contexts/automation/domain/FlowRun'
import { FlowRunId } from '@/contexts/automation/domain/ids'

// In-memory test double for `flow_runs`.
export class InMemoryFlowRunRepository implements FlowRunRepository {
  private readonly runs = new Map<string, FlowRun>()

  nextId(): FlowRunId {
    return FlowRunId.of(randomUUID())
  }

  async findById(id: FlowRunId): Promise<FlowRun | null> {
    return this.runs.get(id.value) ?? null
  }

  async save(run: FlowRun): Promise<void> {
    this.runs.set(run.id.value, run)
  }
}
