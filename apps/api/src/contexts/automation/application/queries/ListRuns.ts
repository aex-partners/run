// `flows.listRuns`: runs (optionally for one flow), newest first, limited.
export interface FlowRunListItem {
  id: string
  flowId: string
  flowVersionId: string | null
  status: string
  triggeredBy: string | null
  duration: number | null
  error: string | null
  startedAt: Date | null
  completedAt: Date | null
  createdAt: Date
}

export interface ListRuns {
  execute(q: { flowId?: string; limit?: number }): Promise<FlowRunListItem[]>
}
