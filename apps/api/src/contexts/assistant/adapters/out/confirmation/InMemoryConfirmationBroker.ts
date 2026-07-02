import { ConfirmationBroker } from '@/contexts/assistant/application/ports/out/ConfirmationBroker'

interface PendingConfirmation {
  resolve: (allowed: boolean) => void
  toolName: string
  conversationId: string
  timer: ReturnType<typeof setTimeout>
}

const TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

// Driven adapter for ConfirmationBroker. Ported 1:1 from confirmation-broker.ts.
// Holds the pending tool confirmations in process memory keyed by toolUseId, with
// a timeout that auto-rejects. A single-process broker; if the API is ever scaled
// horizontally this becomes a Redis pub/sub adapter behind the same port.
export class InMemoryConfirmationBroker implements ConfirmationBroker {
  private readonly pending = new Map<string, PendingConfirmation>()

  request(toolUseId: string, toolName: string, conversationId: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(toolUseId)
        resolve(false) // auto-reject on timeout
      }, TIMEOUT_MS)

      this.pending.set(toolUseId, { resolve, toolName, conversationId, timer })
    })
  }

  resolve(toolUseId: string, allowed: boolean, conversationId?: string): boolean {
    const entry = this.pending.get(toolUseId)
    if (!entry) return false
    // Verify the confirmation belongs to the expected conversation.
    if (conversationId && entry.conversationId !== conversationId) return false

    clearTimeout(entry.timer)
    this.pending.delete(toolUseId)
    entry.resolve(allowed)
    return true
  }

  cancelForConversation(conversationId: string): void {
    for (const [id, entry] of this.pending) {
      if (entry.conversationId === conversationId) {
        clearTimeout(entry.timer)
        this.pending.delete(id)
        entry.resolve(false)
      }
    }
  }
}
