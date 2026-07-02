import { TaskAssignee } from '@/contexts/tasks/domain/TaskAssignee'
import { TaskId } from '@/contexts/tasks/domain/ids'

// Driven port for the per-assignee state of a task. `listByTask` backs both the
// visibility check and the "all acked?" computation; `findOne` loads a single
// assignment to transition it.
export interface TaskAssigneeRepository {
  findOne(taskId: TaskId, userId: string): Promise<TaskAssignee | null>
  listByTask(taskId: TaskId): Promise<TaskAssignee[]>
  saveAll(assignees: TaskAssignee[]): Promise<void>
  save(assignee: TaskAssignee): Promise<void>
}
