import { FlowRun, FlowRunStatus } from '@/contexts/automation/domain/FlowRun'
import { FlowId, FlowRunId, FlowVersionId } from '@/contexts/automation/domain/ids'

export interface FlowRunRow {
  id: string
  flowId: string
  flowVersionId: string | null
  status: FlowRunStatus
  triggeredBy: string | null
  triggerPayload: string | null
  steps: string
  duration: number | null
  tags: string
  error: string | null
  startedAt: Date | null
  completedAt: Date | null
  createdAt: Date
}

export const FlowRunMapper = {
  toPersistence(run: FlowRun): FlowRunRow {
    return {
      id: run.id.value,
      flowId: run.flowId.value,
      flowVersionId: run.flowVersionId?.value ?? null,
      status: run.status,
      triggeredBy: run.triggeredBy,
      triggerPayload: run.triggerPayloadRaw,
      steps: run.stepsRaw,
      duration: run.duration,
      tags: run.tagsRaw,
      error: run.error,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      createdAt: run.createdAt,
    }
  },

  toDomain(row: FlowRunRow): FlowRun {
    return FlowRun.rehydrate({
      id: FlowRunId.of(row.id),
      flowId: FlowId.of(row.flowId),
      flowVersionId: row.flowVersionId === null ? null : FlowVersionId.of(row.flowVersionId),
      status: row.status,
      triggeredBy: row.triggeredBy,
      triggerPayloadRaw: row.triggerPayload,
      stepsRaw: row.steps,
      duration: row.duration,
      tagsRaw: row.tags,
      error: row.error,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      createdAt: row.createdAt,
    })
  },
}
