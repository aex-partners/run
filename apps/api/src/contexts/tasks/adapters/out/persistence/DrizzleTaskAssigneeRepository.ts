import { and, eq } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { taskAssignees } from '@/platform/db/schema'
import { TaskAssigneeRepository } from '@/contexts/tasks/application/ports/out/TaskAssigneeRepository'
import { TaskAssignee } from '@/contexts/tasks/domain/TaskAssignee'
import { TaskId } from '@/contexts/tasks/domain/ids'
import { TaskAssigneeMapper } from '@/contexts/tasks/application/mappers/TaskAssigneeMapper'

// Driven adapter over the `task_assignees` table (composite PK of taskId+userId).
// `save` upserts a single assignment (create + ack/snooze transitions); the
// composite-key conflict target updates the interaction-state columns.
export class DrizzleTaskAssigneeRepository implements TaskAssigneeRepository {
  constructor(private readonly db: Database) {}

  async findOne(taskId: TaskId, userId: string): Promise<TaskAssignee | null> {
    const [row] = await this.db
      .select()
      .from(taskAssignees)
      .where(and(eq(taskAssignees.taskId, taskId.value), eq(taskAssignees.userId, userId)))
      .limit(1)
    return row ? TaskAssigneeMapper.toDomain(row) : null
  }

  async listByTask(taskId: TaskId): Promise<TaskAssignee[]> {
    const rows = await this.db
      .select()
      .from(taskAssignees)
      .where(eq(taskAssignees.taskId, taskId.value))
    return rows.map((r) => TaskAssigneeMapper.toDomain(r))
  }

  async saveAll(assignees: TaskAssignee[]): Promise<void> {
    for (const assignee of assignees) await this.save(assignee)
  }

  async save(assignee: TaskAssignee): Promise<void> {
    const row = TaskAssigneeMapper.toPersistence(assignee)
    await this.db
      .insert(taskAssignees)
      .values(row)
      .onConflictDoUpdate({
        target: [taskAssignees.taskId, taskAssignees.userId],
        set: {
          seenAt: row.seenAt,
          readAt: row.readAt,
          acknowledgedAt: row.acknowledgedAt,
          snoozedUntil: row.snoozedUntil,
        },
      })
  }
}
