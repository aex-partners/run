import { Result } from '@/shared/kernel/Result'
import { ConversationView } from '@/contexts/conversations/application/queries/GetConversation'

// Driving port. Associates (or clears) the AI agent bound to a conversation. The
// caller must be a member.
export interface SetConversationAgentCommand {
  conversationId: string
  actorId: string
  agentId: string | null
}

export interface SetConversationAgent {
  execute(cmd: SetConversationAgentCommand): Promise<Result<ConversationView>>
}
