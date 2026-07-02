import { Json } from '@/shared/domain/Json'
import { Result } from '@/shared/kernel/Result'

// `flows.execute`: create a pending run against the published (or latest) version
// and enqueue it. This is the synchronous trigger path; the worker runs it.
export interface TriggerFlowCommand {
  flowId: string
  triggeredBy: string | null
  triggerPayload?: Json
}

export interface TriggerFlow {
  execute(cmd: TriggerFlowCommand): Promise<Result<{ runId: string }>>
}
