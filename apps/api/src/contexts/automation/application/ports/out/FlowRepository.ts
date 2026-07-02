import { Flow } from '@/contexts/automation/domain/Flow'
import { FlowId, RunId } from '@/contexts/automation/domain/ids'

export interface FlowRepository {
  nextRunId(): RunId
  findById(id: FlowId): Promise<Flow | null>
  save(flow: Flow): Promise<void>
}
