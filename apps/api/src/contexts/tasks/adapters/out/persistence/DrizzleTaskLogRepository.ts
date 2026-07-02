import { randomUUID } from 'node:crypto'
import { Database } from '@/platform/db/client'
import { taskLogs } from '@/platform/db/schema'
import { TaskLogRepository } from '@/contexts/tasks/application/ports/out/TaskLogRepository'
import { TaskLog } from '@/contexts/tasks/domain/TaskLog'
import { TaskLogId } from '@/contexts/tasks/domain/ids'
import { TaskLogMapper } from '@/contexts/tasks/application/mappers/TaskLogMapper'

// Driven adapter over the `task_logs` table. `append` is best-effort: a logging
// fault must never break task execution (AEX: "logging must never break task
// execution"), so it swallows and reports errors instead of rethrowing.
export class DrizzleTaskLogRepository implements TaskLogRepository {
  constructor(private readonly db: Database) {}

  nextId(): TaskLogId {
    return TaskLogId.of(randomUUID())
  }

  async append(log: TaskLog): Promise<void> {
    try {
      const row = TaskLogMapper.toPersistence(log)
      await this.db.insert(taskLogs).values({
        id: row.id,
        taskId: row.taskId,
        level: row.level,
        message: row.message,
        metadata: row.metadata,
        createdAt: row.createdAt,
      })
    } catch (err) {
      console.error('[tasks] failed to write task_log:', err instanceof Error ? err.message : err)
    }
  }
}
