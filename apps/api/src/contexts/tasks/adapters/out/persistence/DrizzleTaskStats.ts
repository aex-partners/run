import { sql } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { TaskStats, TaskStatsQuery, TaskStatsView } from '@/contexts/tasks/application/queries/TaskStats'

// Read-side adapter (CQRS). Aggregate counts over the user's visible tasks in a
// single grouped query with FILTER clauses (AEX `tasks.stats`). completedToday is
// scoped to the DB's current date.
export class DrizzleTaskStats implements TaskStats {
  constructor(private readonly db: Database) {}

  async execute(q: TaskStatsQuery): Promise<TaskStatsView> {
    const rows = await this.db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status = 'running') as running,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) FILTER (WHERE status = 'completed' AND completed_at >= CURRENT_DATE) as completed_today
      FROM tasks
      WHERE created_by = ${q.userId}
        OR EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = tasks.id AND ta.user_id = ${q.userId})
    `)

    const result = (rows as unknown as Array<Record<string, unknown>>)[0]
    return {
      running: Number(result?.running) || 0,
      pending: Number(result?.pending) || 0,
      failed: Number(result?.failed) || 0,
      completedToday: Number(result?.completed_today) || 0,
    }
  }
}
