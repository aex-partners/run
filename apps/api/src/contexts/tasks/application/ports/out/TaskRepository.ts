import { Task } from '@/contexts/tasks/domain/Task'
import { TaskId } from '@/contexts/tasks/domain/ids'

// Driven port. The application states WHAT it needs from persistence; an adapter
// under adapters/out implements HOW (Drizzle/Postgres, in-memory, etc.). `save`
// upserts: create and every transition land here.
export interface TaskRepository {
  nextId(): TaskId
  findById(id: TaskId): Promise<Task | null>
  save(task: Task): Promise<void>
}
