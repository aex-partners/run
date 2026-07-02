import { Result } from '@/shared/kernel/Result'
import { ToolClass } from '@/contexts/tasks/domain/TaskBudget'

// ACL (anti-corruption) out-port. The tasks context MUST NOT import the assistant
// / AI context: it declares WHAT it needs (run a task through the agentic loop or
// a single structured tool) and the composition root bridges this to that
// context's runner (Claude Agent SDK, system-tool registry, spend tracker).
//
// Budget enforcement stays in the tasks domain: the adapter classifies each tool
// call (it owns `isReadOnlyTool` and the tool names) and calls back the pure
// `guard` the RunTaskService supplies, which charges the TaskBudget VO and writes
// the audit log. The adapter honours the returned allow/deny.

export interface AgentToolRequest {
  toolName: string
  toolClass: ToolClass
  input: unknown
}

export type AgentToolDecision = { behavior: 'allow' } | { behavior: 'deny'; message: string }

export type AgentToolGuard = (req: AgentToolRequest) => Promise<AgentToolDecision>

export interface InferenceRunRequest {
  taskId: string
  prompt: string
  conversationId: string
  userId: string
  agentId: string | null
  guard: AgentToolGuard
}

export interface StructuredRunRequest {
  taskId: string
  toolName: string
  structuredInput: string | null
  conversationId: string | null
  userId: string
}

export interface AgentRunOutput {
  text: string
}

// Failure carries whether it was a cancellation (TaskCancelledException in AEX) —
// the shell flips the task to `cancelled` rather than `failed` and skips the
// failure report. The spend-cap breach (assertUnderBudget) surfaces here as a
// non-cancelled failure.
export interface AgentRunFailure {
  cancelled: boolean
  message: string
}

export interface AgentRunner {
  runInference(req: InferenceRunRequest): Promise<Result<AgentRunOutput, AgentRunFailure>>
  runStructured(req: StructuredRunRequest): Promise<Result<AgentRunOutput, AgentRunFailure>>
}
