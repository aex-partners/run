import { TaskLogLevel } from '@/contexts/tasks/domain/TaskStatus'

// Read side (CQRS). Execution audit trail for a task, oldest-first. Scoped by the
// same visibility rule as the task itself: returns [] when the user may not
// access the task (mirrors AEX's `canAccessTask` guard before the query).
export interface TaskLogView {
  id: string
  taskId: string
  level: TaskLogLevel
  message: string
  metadata: string | null
  createdAt: Date
}

export interface ListTaskLogsQuery {
  userId: string
  taskId: string
  limit: number
}

export interface ListTaskLogs {
  execute(query: ListTaskLogsQuery): Promise<TaskLogView[]>
}
