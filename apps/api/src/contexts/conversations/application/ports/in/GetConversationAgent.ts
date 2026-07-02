// Provider in-port. Exposes the AI agent bound to a conversation (its agentId, or
// null) so OTHER contexts (the assistant context) can resolve it without reading
// the conversations-owned `conversations` table directly. main bridges the
// assistant context's out-port to this in-port.
export interface GetConversationAgent {
  execute(conversationId: string): Promise<string | null>
}
