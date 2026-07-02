import { TaskAssignee } from '@/contexts/tasks/domain/TaskAssignee'

// Persistence row: the on-disk shape of the `task_assignees` table (composite PK
// of taskId + userId).
export interface TaskAssigneeRow {
  taskId: string
  userId: string
  seenAt: Date | null
  readAt: Date | null
  acknowledgedAt: Date | null
  snoozedUntil: Date | null
  createdAt: Date
}

export const TaskAssigneeMapper = {
  toPersistence(assignee: TaskAssignee): TaskAssigneeRow {
    return {
      taskId: assignee.taskId,
      userId: assignee.userId,
      seenAt: assignee.seenAt,
      readAt: assignee.readAt,
      acknowledgedAt: assignee.acknowledgedAt,
      snoozedUntil: assignee.snoozedUntil,
      createdAt: assignee.createdAt,
    }
  },

  toDomain(row: TaskAssigneeRow): TaskAssignee {
    return TaskAssignee.rehydrate({
      taskId: row.taskId,
      userId: row.userId,
      seenAt: row.seenAt,
      readAt: row.readAt,
      acknowledgedAt: row.acknowledgedAt,
      snoozedUntil: row.snoozedUntil,
      createdAt: row.createdAt,
    })
  },
}
