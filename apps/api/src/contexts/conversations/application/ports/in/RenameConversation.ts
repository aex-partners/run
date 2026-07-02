import { Result } from '@/shared/kernel/Result'
import { ConversationView } from '@/contexts/conversations/application/queries/GetConversation'

// Driving port. Renames a conversation. The caller must be a member.
export interface RenameConversationCommand {
  id: string
  actorId: string
  name: string
}

export interface RenameConversation {
  execute(cmd: RenameConversationCommand): Promise<Result<ConversationView>>
}
