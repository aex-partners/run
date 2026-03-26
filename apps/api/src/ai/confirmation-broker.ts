interface PendingConfirmation {
  resolve: (allowed: boolean) => void;
  toolName: string;
  conversationId: string;
  timer: ReturnType<typeof setTimeout>;
}

const pending = new Map<string, PendingConfirmation>();

const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Request confirmation for a tool call. Returns a promise that resolves
 * when the user approves/rejects, or rejects after timeout.
 */
export function requestConfirmation(
  toolUseId: string,
  toolName: string,
  conversationId: string,
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(toolUseId);
      resolve(false); // auto-reject on timeout
    }, TIMEOUT_MS);

    pending.set(toolUseId, { resolve, toolName, conversationId, timer });
  });
}

/**
 * Resolve a pending confirmation. Verifies conversation membership via conversationId.
 * Returns true if a pending entry was found and resolved.
 */
export function resolveConfirmation(toolUseId: string, allowed: boolean, conversationId?: string): boolean {
  const entry = pending.get(toolUseId);
  if (!entry) return false;

  // Verify the confirmation belongs to the expected conversation
  if (conversationId && entry.conversationId !== conversationId) return false;

  clearTimeout(entry.timer);
  pending.delete(toolUseId);
  entry.resolve(allowed);
  return true;
}

/**
 * Cancel all pending confirmations for a conversation (e.g., on disconnect).
 */
export function cancelPendingForConversation(conversationId: string): void {
  for (const [id, entry] of pending) {
    if (entry.conversationId === conversationId) {
      clearTimeout(entry.timer);
      pending.delete(id);
      entry.resolve(false);
    }
  }
}
