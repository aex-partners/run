import { Json, JsonObject } from '@/shared/domain/Json'
import { SubagentDef } from '@/contexts/assistant/domain/Subagents'

// Driven port: the STREAMING LLM. The Claude Agent SDK is one adapter behind it
// (ClaudeAgentRuntime); the SDK owns the inner tool loop, so this port emits the
// loop's progress as events instead of returning a single turn (that is the
// non-streaming AgentRuntime, kept for the demo). Swapping models = one new
// adapter; the core never imports the SDK.

export type AgentEvent =
  | { type: 'session_init'; sessionId: string }
  | { type: 'text_delta'; delta: string }
  | { type: 'thinking_delta'; delta: string }
  | { type: 'tool_start'; toolUseId: string; toolName: string; input: JsonObject }
  | { type: 'tool_result'; toolUseId: string; result: Json; isError: boolean }
  | { type: 'text_reset'; reason: string }
  | { type: 'result'; sessionId: string; totalCostUsd?: number; numTurns?: number }
  | { type: 'error'; message: string }

// The confirmation gate handed to the runtime. The runtime calls it before a tool
// executes; the use case decides (read-only -> allow, mutating -> ask the human).
// Mirrors the SDK's CanUseTool, but expressed in our own terms so the core never
// depends on the SDK type.
export type ToolDecision = { allow: true } | { allow: false; message: string }
export type ToolGate = (toolName: string, input: JsonObject, ctx: { toolUseId: string }) => Promise<ToolDecision>

export interface AgentRunRequest {
  prompt: string
  systemPrompt: string
  model: string
  allowedTools: readonly string[]
  resumeSessionId: string | null
  subagents: Record<string, SubagentDef>
  maxTurns: number
  canUseTool: ToolGate
}

export interface ChatAgentRuntime {
  stream(req: AgentRunRequest): AsyncIterable<AgentEvent>
}
