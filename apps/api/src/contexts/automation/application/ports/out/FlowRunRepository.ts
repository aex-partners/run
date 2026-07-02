import { FlowRun } from '@/contexts/automation/domain/FlowRun'
import { FlowRunId } from '@/contexts/automation/domain/ids'

// Driven port for `flow_runs`. `save` is an upsert covering both the initial
// pending insert and every status transition.
export interface FlowRunRepository {
  nextId(): FlowRunId
  findById(id: FlowRunId): Promise<FlowRun | null>
  save(run: FlowRun): Promise<void>
}
