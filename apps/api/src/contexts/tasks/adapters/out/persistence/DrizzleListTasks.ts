import { and, asc, desc, eq, gt, inArray, isNotNull, SQL } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { tasks, taskAssignees } from '@/platform/db/schema'
import { ListTasks, ListTasksQuery, TaskView } from '@/contexts/tasks/application/queries/ListTasks'
import { visibleTasksWhere, taskRowToView } from '@/contexts/tasks/adapters/out/persistence/taskVisibility'

// Read-side adapter (CQRS). Applies the visibility WHERE clause, optional status
// / scheduled filters, then joins the assignee ids in a second query. Scheduled
// view sorts soonest-first; the board sorts newest-first (matches AEX `tasks.list`).
export class DrizzleListTasks implements ListTasks {
  constructor(private readonly db: Database) {}

  async execute(q: ListTasksQuery): Promise<TaskView[]> {
    const conditions: (SQL | undefined)[] = [visibleTasksWhere(q.userId)]
    if (q.status) conditions.push(eq(tasks.status, q.status))
    if (q.scheduledOnly) {
      conditions.push(eq(tasks.status, 'pending'))
      conditions.push(isNotNull(tasks.scheduledAt))
      conditions.push(gt(tasks.scheduledAt, new Date()))
    }

    const order = q.scheduledOnly ? asc(tasks.scheduledAt) : desc(tasks.createdAt)

    const rows = await this.db
      .select()
      .from(tasks)
      .where(and(...conditions))
      .orderBy(order)
      .limit(q.limit)
      .offset(q.offset)

    const ids = rows.map((r) => r.id)
    const assignees = ids.length
      ? await this.db.select().from(taskAssignees).where(inArray(taskAssignees.taskId, ids))
      : []

    const byTask = new Map<string, string[]>()
    for (const a of assignees) {
      const list = byTask.get(a.taskId) ?? []
      list.push(a.userId)
      byTask.set(a.taskId, list)
    }

    return rows.map((r) => taskRowToView(r, byTask.get(r.id) ?? []))
  }
}
