// Driven port: the human-in-the-loop confirmation channel for mutating tools. The
// use case requests confirmation and awaits the user's verdict (resolved by a
// separate HTTP call) or a timeout. Ported from confirmation-broker.ts; the
// in-memory pending map is one adapter behind it.
export interface ConfirmationBroker {
  // Awaits the user's approve/reject for a tool call, or auto-rejects on timeout.
  request(toolUseId: string, toolName: string, conversationId: string): Promise<boolean>

  // Resolves a pending request. Verifies the entry belongs to `conversationId`.
  // Returns true when a pending entry was found and resolved.
  resolve(toolUseId: string, allowed: boolean, conversationId?: string): boolean

  // Cancels (auto-rejects) every pending request for a conversation.
  cancelForConversation(conversationId: string): void
}
