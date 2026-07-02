import { Json } from '@/shared/domain/Json'

// `flows.getRun`: a run with its `steps` JSON parsed into an object.
export interface FlowRunDetailView {
  id: string
  flowId: string
  flowVersionId: string | null
  status: string
  triggeredBy: string | null
  triggerPayload: string | null
  steps: Json
  duration: number | null
  error: string | null
  startedAt: Date | null
  completedAt: Date | null
  createdAt: Date
}

export interface GetRun {
  execute(q: { runId: string }): Promise<FlowRunDetailView | null>
}
