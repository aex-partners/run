import { desc, eq } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { flowRuns } from '@/platform/db/schema'
import { ListRuns, FlowRunListItem } from '@/contexts/automation/application/queries/ListRuns'

// Read-side adapter. Ports `flows.listRuns`: optionally scoped to a flow, newest
// first, limited (default 50).
export class DrizzleListRuns implements ListRuns {
  constructor(private readonly db: Database) {}

  async execute(q: { flowId?: string; limit?: number }): Promise<FlowRunListItem[]> {
    const base = this.db.select().from(flowRuns)
    const filtered = q.flowId ? base.where(eq(flowRuns.flowId, q.flowId)) : base
    const rows = await filtered.orderBy(desc(flowRuns.createdAt)).limit(q.limit ?? 50)
    return rows.map((r) => ({
      id: r.id,
      flowId: r.flowId,
      flowVersionId: r.flowVersionId,
      status: r.status,
      triggeredBy: r.triggeredBy,
      duration: r.duration,
      error: r.error,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      createdAt: r.createdAt,
    }))
  }
}
