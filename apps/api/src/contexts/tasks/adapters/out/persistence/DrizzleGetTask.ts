import { and, eq } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { tasks, taskAssignees } from '@/platform/db/schema'
import { GetTask, GetTaskQuery } from '@/contexts/tasks/application/queries/GetTask'
import { TaskView } from '@/contexts/tasks/application/queries/ListTasks'
import { visibleTasksWhere, taskRowToView } from '@/contexts/tasks/adapters/out/persistence/taskVisibility'

// Read-side adapter (CQRS). Single task scoped by the visibility clause, with its
// assignee ids. Returns null when missing or not visible (AEX `tasks.getById`).
export class DrizzleGetTask implements GetTask {
  constructor(private readonly db: Database) {}

  async execute(q: GetTaskQuery): Promise<TaskView | null> {
    const [task] = await this.db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, q.id), visibleTasksWhere(q.userId)))
      .limit(1)
    if (!task) return null

    const assignees = await this.db
      .select({ userId: taskAssignees.userId })
      .from(taskAssignees)
      .where(eq(taskAssignees.taskId, task.id))

    return taskRowToView(task, assignees.map((a) => a.userId))
  }
}
