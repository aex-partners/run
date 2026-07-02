import { Result } from '@/shared/kernel/Result'

// Driving port. Plain-data command in, plain-data out — no domain object crosses
// the boundary. `createdBy` is the acting user (set by the adapter from session).
export interface CreateKnowledgeCommand {
  scope: string
  category: string
  title: string
  content: string
  createdBy: string
  sourceFileId?: string | null
}

export interface CreateKnowledge {
  execute(cmd: CreateKnowledgeCommand): Promise<Result<{ id: string }>>
}
