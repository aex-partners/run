import { Json, JsonObject } from '@/shared/domain/Json'

// Driving port: the real streaming chat orchestration. `execute` yields a stream
// of transport-agnostic ChatEvents; the HTTP/SSE adapter maps each to a wire
// frame. Ported from chat-handler.ts (the SSEEvent contract) but decoupled from
// Fastify — the use case knows nothing about `reply.raw`.
export type ChatEvent =
  | { type: 'session_init'; sessionId: string; agentName: string }
  | { type: 'text_delta'; delta: string }
  | { type: 'thinking_delta'; delta: string }
  | { type: 'tool_start'; toolUseId: string; toolName: string; input: JsonObject }
  | { type: 'tool_result'; toolUseId: string; result: Json; isError: boolean }
  | { type: 'tool_confirmation_required'; toolUseId: string; toolName: string; input: JsonObject; description: string }
  | { type: 'text_reset'; reason: string }
  | { type: 'result'; sessionId: string; totalCostUsd?: number; numTurns?: number }
  | { type: 'error'; message: string }

export interface ChatCommand {
  conversationId: string
  userId: string
  prompt: string
}

export interface ResolveConfirmationCommand {
  toolUseId: string
  allowed: boolean
  conversationId: string
}

export interface Chat {
  // Streams the agent's turn. The same decide -> confirm -> execute -> feed-back
  // loop as SendMessage, but the LLM owns the loop internally and we stream its
  // progress, gate mutating tools on human confirmation, and cap spend.
  execute(cmd: ChatCommand): AsyncIterable<ChatEvent>

  // Resolves a pending tool confirmation (the `/api/chat/confirm` endpoint).
  // Returns true when a matching pending entry was found.
  resolveConfirmation(cmd: ResolveConfirmationCommand): boolean

  // Cancels all pending confirmations for a conversation (e.g. on disconnect).
  cancel(conversationId: string): void
}
