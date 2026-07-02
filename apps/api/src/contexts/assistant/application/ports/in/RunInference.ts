import { Result } from '@/shared/kernel/Result'

// Driving port: NON-STREAMING, run-to-completion inference. The streaming `Chat`
// in-port owns an SSE turn for a human watching the loop; this is its batch twin
// for callers that just want the final answer (tasks.AgentRunner runs a structured
// inference task to completion; email.AiDrafter summarises / drafts an email). No
// SSE, no confirmation prompts — it runs UNATTENDED, so mutating tools are gated by
// a hard budget instead of a human (see RunInferenceService).
//
// Other contexts never import this directly. They declare their own out-port
// (AgentRunner / AiDrafter); main fulfils it by adapting to this in-port.

export interface RunInferenceCommand {
  // Optional steering prompt prepended to the conversation as a system turn.
  systemPrompt?: string
  // The user/task instruction the model answers.
  prompt: string
  // Tool allow-list for this run. Defaults to the whole ToolBox when omitted.
  allowedTools?: string[]
  // Hard cap on mutating tool calls for this unattended run. Beyond it, mutating
  // tools are denied (read-only stays unlimited). Defaults to the background limit.
  maxMutations?: number
  // Per-key daily spend bucket (e.g. user/tenant id). When set and a SpendStore is
  // wired, the run is pre-checked against the daily Budget cap.
  budgetKey?: string
}

export interface RunInferenceResult {
  // The model's final text answer.
  text: string
  // The tool calls that actually executed, in order (bare names, no MCP prefix).
  toolCalls: { name: string; input: unknown }[]
}

export interface RunInference {
  execute(cmd: RunInferenceCommand): Promise<Result<RunInferenceResult>>
}
