// Provider in-port. The Claude Agent SDK session id bound to an AI conversation is
// persisted on the conversations-context-owned `conversations.session_id` column.
// The assistant context must NOT read that table directly: it declares its
// SessionStore out-port and main bridges it to this in-port, so the conversations
// context stays the sole owner of its table. `saveSessionId` is CAS-style: it
// writes only when the stored value still equals `expectedPrevious` (null = write
// only when empty), so two concurrent turns can't clobber each other's session.
export interface SaveSessionIdInput {
  conversationId: string
  sessionId: string
  expectedPrevious: string | null
}

export interface ManageSession {
  getSessionId(conversationId: string): Promise<string | null>
  saveSessionId(input: SaveSessionIdInput): Promise<boolean>
  clearSessionId(conversationId: string): Promise<void>
}
