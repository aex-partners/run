import { TaskLog } from '@/contexts/tasks/domain/TaskLog'
import { TaskLogId, TaskId } from '@/contexts/tasks/domain/ids'
import { TaskLogLevel } from '@/contexts/tasks/domain/TaskStatus'

// Persistence row: the on-disk shape of the `task_logs` table. `metadata` is
// stored as a JSON string (AEX `JSON.stringify(metadata)`); the mapper is the
// only place that (de)serializes it.
export interface TaskLogRow {
  id: string
  taskId: string
  level: TaskLogLevel
  message: string
  metadata: string | null
  createdAt: Date
}

export const TaskLogMapper = {
  toPersistence(log: TaskLog): TaskLogRow {
    return {
      id: log.id.value,
      taskId: log.taskId.value,
      level: log.level,
      message: log.message,
      metadata: log.metadata ? JSON.stringify(log.metadata) : null,
      createdAt: log.createdAt,
    }
  },

  toDomain(row: TaskLogRow): TaskLog {
    const metadata = row.metadata
      ? (JSON.parse(row.metadata) as Record<string, unknown>)
      : null
    return TaskLog.rehydrate(
      TaskLogId.of(row.id),
      TaskId.of(row.taskId),
      row.level,
      row.message,
      metadata,
      row.createdAt,
    )
  },
}
