import { TaskStatus, ApprovalDecision } from '@/contexts/tasks/domain/TaskStatus'
import { TaskKindValue } from '@/contexts/tasks/domain/TaskKind'
import { TaskExecutorValue } from '@/contexts/tasks/domain/TaskExecutor'
import { TaskTypeValue } from '@/contexts/tasks/domain/TaskType'

// Read side (CQRS). Bypasses the aggregate: an adapter answers it with a direct
// query that applies the visibility WHERE clause and joins the assignee ids.
export interface TaskView {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  progress: number
  kind: TaskKindValue
  type: TaskTypeValue
  executor: TaskExecutorValue
  agentId: string | null
  conversationId: string | null
  createdBy: string
  result: string | null
  error: string | null
  dueAt: Date | null
  snoozedUntil: Date | null
  scheduledAt: Date | null
  parentTaskId: string | null
  approvalDecision: ApprovalDecision | null
  createdAt: Date
  startedAt: Date | null
  completedAt: Date | null
  assigneeIds: string[]
}

export interface ListTasksQuery {
  userId: string
  status?: TaskStatus
  scheduledOnly?: boolean
  limit: number
  offset: number
}

export interface ListTasks {
  execute(query: ListTasksQuery): Promise<TaskView[]>
}
