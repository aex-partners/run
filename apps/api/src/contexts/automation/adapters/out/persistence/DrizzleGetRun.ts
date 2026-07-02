import { eq } from 'drizzle-orm'
import { Json } from '@/shared/domain/Json'
import { Database } from '@/platform/db/client'
import { flowRuns } from '@/platform/db/schema'
import { GetRun, FlowRunDetailView } from '@/contexts/automation/application/queries/GetRun'

// Read-side adapter. Ports `flows.getRun`: the run with its `steps` JSON parsed.
export class DrizzleGetRun implements GetRun {
  constructor(private readonly db: Database) {}

  async execute(q: { runId: string }): Promise<FlowRunDetailView | null> {
    const rows = await this.db.select().from(flowRuns).where(eq(flowRuns.id, q.runId)).limit(1)
    const r = rows[0]
    if (!r) return null
    return {
      id: r.id,
      flowId: r.flowId,
      flowVersionId: r.flowVersionId,
      status: r.status,
      triggeredBy: r.triggeredBy,
      triggerPayload: r.triggerPayload,
      steps: parseJson(r.steps),
      duration: r.duration,
      error: r.error,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      createdAt: r.createdAt,
    }
  }
}

function parseJson(raw: string): Json {
  try {
    return JSON.parse(raw) as Json
  } catch {
    return {}
  }
}
