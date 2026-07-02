import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { flowRuns } from '@/platform/db/schema'
import { FlowRunRepository } from '@/contexts/automation/application/ports/out/FlowRunRepository'
import { FlowRun } from '@/contexts/automation/domain/FlowRun'
import { FlowRunId } from '@/contexts/automation/domain/ids'
import { FlowRunMapper } from '@/contexts/automation/application/mappers/FlowRunMapper'

// Driven adapter over Drizzle/Postgres for `flow_runs`. `save` upserts, covering
// the pending insert and every status transition.
export class DrizzleFlowRunRepository implements FlowRunRepository {
  constructor(private readonly db: Database) {}

  nextId(): FlowRunId {
    return FlowRunId.of(randomUUID())
  }

  async findById(id: FlowRunId): Promise<FlowRun | null> {
    const rows = await this.db.select().from(flowRuns).where(eq(flowRuns.id, id.value)).limit(1)
    const row = rows[0]
    if (!row) return null
    return FlowRunMapper.toDomain({
      id: row.id,
      flowId: row.flowId,
      flowVersionId: row.flowVersionId,
      status: row.status,
      triggeredBy: row.triggeredBy,
      triggerPayload: row.triggerPayload,
      steps: row.steps,
      duration: row.duration,
      tags: row.tags,
      error: row.error,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      createdAt: row.createdAt,
    })
  }

  async save(run: FlowRun): Promise<void> {
    const row = FlowRunMapper.toPersistence(run)
    await this.db
      .insert(flowRuns)
      .values(row)
      .onConflictDoUpdate({
        target: flowRuns.id,
        set: {
          status: row.status,
          triggerPayload: row.triggerPayload,
          steps: row.steps,
          duration: row.duration,
          tags: row.tags,
          error: row.error,
          startedAt: row.startedAt,
          completedAt: row.completedAt,
        },
      })
  }
}
