import { Task } from '@/contexts/tasks/domain/Task'
import { TaskId } from '@/contexts/tasks/domain/ids'
import { TaskStatus, ApprovalDecision } from '@/contexts/tasks/domain/TaskStatus'
import { TaskKind } from '@/contexts/tasks/domain/TaskKind'
import { TaskExecutor } from '@/contexts/tasks/domain/TaskExecutor'
import { TaskType } from '@/contexts/tasks/domain/TaskType'

// Persistence row: the on-disk shape of the `tasks` table. The mapper is the only
// place that knows it; it round-trips the aggregate through the VOs.
export interface TaskRow {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  progress: number
  conversationId: string | null
  createdBy: string
  result: string | null
  error: string | null
  input: string | null
  scheduledAt: Date | null
  type: 'inference' | 'structured'
  agentId: string | null
  toolName: string | null
  inputSchema: string | null
  outputSchema: string | null
  structuredInput: string | null
  executor: 'ai' | 'human'
  kind: 'task' | 'reminder' | 'approval'
  dueAt: Date | null
  snoozedUntil: Date | null
  parentTaskId: string | null
  approvalDecision: ApprovalDecision | null
  createdAt: Date
  startedAt: Date | null
  completedAt: Date | null
}

export const TaskMapper = {
  toPersistence(task: Task): TaskRow {
    return {
      id: task.id.value,
      title: task.title,
      description: task.description,
      status: task.status,
      progress: task.progress,
      conversationId: task.conversationId,
      createdBy: task.createdBy,
      result: task.result,
      error: task.error,
      input: task.input,
      scheduledAt: task.scheduledAt,
      type: task.type.value,
      agentId: task.agentId,
      toolName: task.toolName,
      inputSchema: task.inputSchema,
      outputSchema: task.outputSchema,
      structuredInput: task.structuredInput,
      executor: task.executor.value,
      kind: task.kind.value,
      dueAt: task.dueAt,
      snoozedUntil: task.snoozedUntil,
      parentTaskId: task.parentTaskId,
      approvalDecision: task.approvalDecision,
      createdAt: task.createdAt,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
    }
  },

  toDomain(row: TaskRow): Task {
    const kind = TaskKind.of(row.kind)
    if (!kind.ok) throw new Error(`TaskMapper.toDomain: ${kind.error}`)
    const executor = TaskExecutor.of(row.executor)
    if (!executor.ok) throw new Error(`TaskMapper.toDomain: ${executor.error}`)
    const type = TaskType.of(row.type)
    if (!type.ok) throw new Error(`TaskMapper.toDomain: ${type.error}`)

    return Task.rehydrate({
      id: TaskId.of(row.id),
      title: row.title,
      description: row.description,
      status: row.status,
      progress: row.progress,
      conversationId: row.conversationId,
      createdBy: row.createdBy,
      result: row.result,
      error: row.error,
      input: row.input,
      scheduledAt: row.scheduledAt,
      type: type.value,
      agentId: row.agentId,
      toolName: row.toolName,
      inputSchema: row.inputSchema,
      outputSchema: row.outputSchema,
      structuredInput: row.structuredInput,
      executor: executor.value,
      kind: kind.value,
      dueAt: row.dueAt,
      snoozedUntil: row.snoozedUntil,
      parentTaskId: row.parentTaskId,
      approvalDecision: row.approvalDecision,
      createdAt: row.createdAt,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
    })
  },
}
