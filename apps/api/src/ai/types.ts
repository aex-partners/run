import type { Database } from "../db/index.js";

// SSE events sent to the browser
export type SSEEvent =
  | { type: "session_init"; sessionId: string; agentName: string }
  | { type: "text_delta"; delta: string }
  | { type: "thinking_delta"; delta: string }
  | { type: "tool_start"; toolUseId: string; toolName: string; input: Record<string, unknown> }
  | { type: "tool_result"; toolUseId: string; result: unknown; isError: boolean }
  | { type: "tool_confirmation_required"; toolUseId: string; toolName: string; input: Record<string, unknown>; description: string }
  | { type: "text_reset"; reason: string }
  | { type: "result"; sessionId: string; totalCostUsd?: number; numTurns?: number }
  | { type: "error"; message: string };

export interface AgentConfig {
  id: string;
  name: string;
  systemPrompt: string;
  modelId: string | null;
  toolIds: string[];
  skillPrompts: string[];
}

export interface ToolContext {
  db: Database;
  userId: string;
  conversationId: string;
}
