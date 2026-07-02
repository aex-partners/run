import { Json } from '@/shared/domain/Json'

// Driven port: the LLM. The Claude Agent SDK is ONE adapter behind this port;
// swapping models = one new adapter, the core never imports the SDK.
export interface ToolCall {
  id: string
  name: string
  input: Json
}

export interface AgentTurn {
  text: string | null
  toolCalls: ToolCall[]
}

export interface AgentPrompt {
  messages: { role: string; content: string }[]
  tools: string[]
}

export interface AgentRuntime {
  run(prompt: AgentPrompt): Promise<AgentTurn>
}
