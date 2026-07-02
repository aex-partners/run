import { Result } from '@/shared/kernel/Result'

// Driving port (AEX `tasks.create`). Plain-data command in, plain-data out.
// `kind` is the raw string; the service validates it via the TaskKind VO.
export interface CreateTaskCommand {
  createdBy: string
  title: string
  description?: string | null
  assigneeIds: string[]
  kind?: string
  dueAt?: string | null
  conversationId?: string | null
}

export interface CreateTask {
  execute(cmd: CreateTaskCommand): Promise<Result<{ id: string }>>
}
