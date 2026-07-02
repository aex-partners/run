import { ConversationType } from '@/contexts/conversations/domain/ConversationType'

// The scalar shape of a conversation returned by getById and echoed by the
// create / rename / setAgent mutations.
export interface ConversationView {
  id: string
  name: string | null
  type: ConversationType
  agentId: string | null
  sessionId: string | null
  createdAt: Date
  updatedAt: Date
}

// Read side (CQRS). Returns the conversation only if the caller is a member
// (the source asserts membership; a non-member sees null here). No domain
// involved.
export interface GetConversation {
  execute(input: { id: string; userId: string }): Promise<ConversationView | null>
}
