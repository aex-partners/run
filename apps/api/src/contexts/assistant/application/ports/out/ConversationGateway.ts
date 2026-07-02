// ACL out-port -> the conversations context. The real conversations/messages
// tables are OWNED by that context; the assistant must not import it. It posts and
// reads turns through this gateway, which main bridges to conversations'
// AppendMessage / PostSystemMessage in-ports and the ListMessages query. This is
// the seam that lets the AI persist its turns without depending on conversations.

export interface ConversationTurn {
  role: 'user' | 'ai' | 'system'
  authorName: string
  content: string
  createdAt: Date
}

export interface ConversationGateway {
  // The human turn that kicked off this AI run.
  postUserMessage(input: { conversationId: string; userId: string; content: string }): Promise<void>

  // The agent's final answer. `agentId` is null for the built-in Eric.
  postAssistantMessage(input: {
    conversationId: string
    agentId: string | null
    agentName: string
    content: string
  }): Promise<void>

  // A programmatic system note (no membership guard).
  postSystemMessage(input: { conversationId: string; content: string }): Promise<void>

  // Prior turns, newest-first, for context assembly when not resuming a session.
  history(input: { conversationId: string; userId: string; limit?: number }): Promise<ConversationTurn[]>
}
