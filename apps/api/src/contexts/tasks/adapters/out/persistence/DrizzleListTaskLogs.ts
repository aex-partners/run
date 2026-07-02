import { and, asc, eq } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { tasks, taskLogs } from '@/platform/db/schema'
import {
  ListTaskLogs,
  ListTaskLogsQuery,
  TaskLogView,
} from '@/contexts/tasks/application/queries/ListTaskLogs'
import { visibleTasksWhere } from '@/contexts/tasks/adapters/out/persistence/taskVisibility'

// Read-side adapter (CQRS). Execution audit trail for a task, oldest-first. Same
// visibility guard as AEX's `canAccessTask` check before the query: returns [] if
// the user may not access the task.
export class DrizzleListTaskLogs implements ListTaskLogs {
  constructor(private readonly db: Database) {}

  async execute(q: ListTaskLogsQuery): Promise<TaskLogView[]> {
    const [accessible] = await this.db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.id, q.taskId), visibleTasksWhere(q.userId)))
      .limit(1)
    if (!accessible) return []

    const rows = await this.db
      .select()
      .from(taskLogs)
      .where(eq(taskLogs.taskId, q.taskId))
      .orderBy(asc(taskLogs.createdAt))
      .limit(q.limit)

    return rows.map(
      (r): TaskLogView => ({
        id: r.id,
        taskId: r.taskId,
        level: r.level,
        message: r.message,
        metadata: r.metadata,
        createdAt: r.createdAt,
      }),
    )
  }
}
