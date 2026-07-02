import { Result } from '@/shared/kernel/Result'
import { ConversationType } from '@/contexts/conversations/domain/ConversationType'
import { ConversationView } from '@/contexts/conversations/application/queries/GetConversation'

// Driving port. Creates a conversation with the creator as the first member and
// any additional distinct members. Plain data in/out.
export interface CreateConversationCommand {
  creatorId: string
  name?: string
  type: ConversationType
  memberIds?: string[]
}

export interface CreateConversation {
  execute(cmd: CreateConversationCommand): Promise<Result<ConversationView>>
}
