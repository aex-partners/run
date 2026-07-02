// ACL (anti-corruption) out-port. The runner reports a completed AI task's
// summary (and a reminder's surfacing message) into the originating conversation.
// The tasks context MUST NOT import the conversations/assistant context: the
// composition root bridges this to that context's message in-port. Declared here
// as a plain interface only.
export interface ConversationPostRequest {
  conversationId: string
  userId: string
  role: 'ai' | 'system'
  content: string
  metadata?: Record<string, unknown> | null
}

export interface ConversationPoster {
  post(request: ConversationPostRequest): Promise<void>
}
