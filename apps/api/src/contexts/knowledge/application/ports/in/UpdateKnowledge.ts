import { Result } from '@/shared/kernel/Result'

// `requestedBy` is the acting user; authority (personal entries belong to their
// creator) is enforced by the aggregate, not here.
export interface UpdateKnowledgeCommand {
  id: string
  requestedBy: string
  scope?: string
  category?: string
  title?: string
  content?: string
}

export interface UpdateKnowledge {
  execute(cmd: UpdateKnowledgeCommand): Promise<Result<{ success: true }>>
}
