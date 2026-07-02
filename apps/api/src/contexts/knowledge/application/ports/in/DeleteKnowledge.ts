import { Result } from '@/shared/kernel/Result'

export interface DeleteKnowledgeCommand {
  id: string
  requestedBy: string
}

export interface DeleteKnowledge {
  execute(cmd: DeleteKnowledgeCommand): Promise<Result<{ success: true }>>
}
