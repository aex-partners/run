import { or, eq, sql, SQL } from 'drizzle-orm'
import { tasks } from '@/platform/db/schema'
import { TaskView } from '@/contexts/tasks/application/queries/ListTasks'

// Read-side port of AEX's `visibleTasksWhere`: a task is visible iff the current
// user created it OR is one of its assignees. Lives in the adapter layer (it is
// SQL); the in-memory equivalent for the mutating use cases is
// domain/TaskVisibility.canAccessTask.
export const visibleTasksWhere = (userId: string): SQL | undefined =>
  or(
    eq(tasks.createdBy, userId),
    sql`exists (select 1 from task_assignees ta where ta.task_id = ${tasks.id} and ta.user_id = ${userId})`,
  )

// Shared row -> view shaping for the list/get read paths.
export const taskRowToView = (row: typeof tasks.$inferSelect, assigneeIds: string[]): TaskView => ({
  id: row.id,
  title: row.title,
  description: row.description,
  status: row.status,
  progress: row.progress,
  kind: row.kind,
  type: row.type,
  executor: row.executor,
  agentId: row.agentId,
  conversationId: row.conversationId,
  createdBy: row.createdBy,
  result: row.result,
  error: row.error,
  dueAt: row.dueAt,
  snoozedUntil: row.snoozedUntil,
  scheduledAt: row.scheduledAt,
  parentTaskId: row.parentTaskId,
  approvalDecision: row.approvalDecision,
  createdAt: row.createdAt,
  startedAt: row.startedAt,
  completedAt: row.completedAt,
  assigneeIds,
})
