import { Result } from '@/shared/kernel/Result'
import { MessageRole } from '@/contexts/conversations/domain/MessageRole'

// Narrow driving port for programmatic posts (no membership guard, no attachments).
// This is what reminders' ConversationPoster and the assistant bridge to when they
// need to drop a line into a conversation. Defaults to the `system` role.
export interface PostSystemMessageCommand {
  conversationId: string
  content: string
  role?: MessageRole
  authorId?: string | null
  agentId?: string | null
}

export interface PostSystemMessage {
  execute(cmd: PostSystemMessageCommand): Promise<Result<{ id: string }>>
}
