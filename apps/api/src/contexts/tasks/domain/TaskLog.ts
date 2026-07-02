import { Entity } from '@/shared/kernel/Entity'
import { TaskLogId, TaskId } from '@/contexts/tasks/domain/ids'
import { TaskLogLevel } from '@/contexts/tasks/domain/TaskStatus'

// Append-only audit-trail entry for a task execution. Every budget decision and
// lifecycle marker the unattended runner makes is recorded here, so an admin can
// review exactly what a scheduled task did after the fact. Identity by id; it is
// never mutated after creation.
export class TaskLog extends Entity<TaskLogId> {
  private constructor(
    id: TaskLogId,
    public readonly taskId: TaskId,
    public readonly level: TaskLogLevel,
    public readonly message: string,
    public readonly metadata: Record<string, unknown> | null,
    public readonly createdAt: Date,
  ) {
    super(id)
  }

  static create(
    id: TaskLogId,
    taskId: TaskId,
    level: TaskLogLevel,
    message: string,
    metadata: Record<string, unknown> | null,
    now: Date,
  ): TaskLog {
    return new TaskLog(id, taskId, level, message, metadata, now)
  }

  static rehydrate(
    id: TaskLogId,
    taskId: TaskId,
    level: TaskLogLevel,
    message: string,
    metadata: Record<string, unknown> | null,
    createdAt: Date,
  ): TaskLog {
    return new TaskLog(id, taskId, level, message, metadata, createdAt)
  }
}
