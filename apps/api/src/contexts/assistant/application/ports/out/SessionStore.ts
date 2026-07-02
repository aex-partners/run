// Driven ACL out-port: the Claude Agent session id bound to a conversation, so a
// follow-up turn resumes the same SDK session. The id is persisted on the
// conversations-context-owned `conversations` row, so the assistant must not read
// that table directly: it declares WHAT it needs here and main bridges HOW to the
// conversations context (no adapter lives in this context). saveSessionId is
// CAS-style: it only writes when the stored value still matches `expectedPrevious`
// (pass null to write only when empty), so two concurrent turns can't stomp each
// other's session.
export interface SessionStore {
  getSessionId(conversationId: string): Promise<string | null>
  saveSessionId(conversationId: string, sessionId: string, expectedPrevious?: string | null): Promise<boolean>
  clearSessionId(conversationId: string): Promise<void>
}
