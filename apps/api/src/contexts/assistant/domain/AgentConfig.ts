// VO. The resolved configuration for the agent that answers a conversation:
// identity, system prompt, model, and the tools/skills it carries. Built by the
// AgentDirectory out-port (ACL -> agents/skills contexts + prompt assembly) and
// consumed by the chat orchestration. `id === 'default'` marks the built-in Eric
// (no row in the agents table).
export interface AgentConfig {
  id: string
  name: string
  systemPrompt: string
  modelId: string | null
  toolIds: string[]
  skillPrompts: string[]
}

export const DEFAULT_AGENT_ID = 'default'
export const DEFAULT_AGENT_NAME = 'Eric'

// Default model for the user-facing agent, ported from chat-handler.ts. Overridable
// per-agent via AgentConfig.modelId.
export const DEFAULT_MODEL = 'claude-sonnet-4-6'
