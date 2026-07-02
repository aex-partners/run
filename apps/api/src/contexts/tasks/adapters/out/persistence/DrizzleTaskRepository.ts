import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { tasks } from '@/platform/db/schema'
import { TaskRepository } from '@/contexts/tasks/application/ports/out/TaskRepository'
import { Task } from '@/contexts/tasks/domain/Task'
import { TaskId } from '@/contexts/tasks/domain/ids'
import { TaskMapper } from '@/contexts/tasks/application/mappers/TaskMapper'

// Driven adapter. Stores the aggregate in the `tasks` table. `save` upserts
// (create + every transition land here); createdAt and createdBy are never
// overwritten on conflict. The port and the mapper are the only contract the
// application sees.
export class DrizzleTaskRepository implements TaskRepository {
  constructor(private readonly db: Database) {}

  nextId(): TaskId {
    return TaskId.of(randomUUID())
  }

  async findById(id: TaskId): Promise<Task | null> {
    const [row] = await this.db.select().from(tasks).where(eq(tasks.id, id.value)).limit(1)
    return row ? TaskMapper.toDomain(row) : null
  }

  async save(task: Task): Promise<void> {
    const row = TaskMapper.toPersistence(task)
    await this.db
      .insert(tasks)
      .values(row)
      .onConflictDoUpdate({
        target: tasks.id,
        set: {
          title: row.title,
          description: row.description,
          status: row.status,
          progress: row.progress,
          conversationId: row.conversationId,
          result: row.result,
          error: row.error,
          input: row.input,
          scheduledAt: row.scheduledAt,
          type: row.type,
          agentId: row.agentId,
          toolName: row.toolName,
          inputSchema: row.inputSchema,
          outputSchema: row.outputSchema,
          structuredInput: row.structuredInput,
          executor: row.executor,
          kind: row.kind,
          dueAt: row.dueAt,
          snoozedUntil: row.snoozedUntil,
          parentTaskId: row.parentTaskId,
          approvalDecision: row.approvalDecision,
          startedAt: row.startedAt,
          completedAt: row.completedAt,
        },
      })
  }
}
