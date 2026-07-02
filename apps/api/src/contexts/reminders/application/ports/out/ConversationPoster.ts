// ACL (anti-corruption) out-port. When a reminder fires, FireReminder posts it
// as a message into the originating conversation. The reminders context MUST NOT
// import the conversations/assistant context: the composition root (main) bridges
// this port to that context's in-port. Declared here as a plain interface only.
export interface ConversationPosterRequest {
  conversationId: string
  userId: string
  content: string
}

export interface ConversationPoster {
  post(request: ConversationPosterRequest): Promise<void>
}
