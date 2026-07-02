import { AgentPrompt, AgentRuntime, AgentTurn } from '@/contexts/assistant/application/ports/out/AgentRuntime'

// Placeholder driven adapter for the LLM port. The real one wraps
// @anthropic-ai/claude-agent-sdk and streams tool calls. This deterministic stub
// drives a scripted "create an entity, then confirm" so the tool loop runs
// without an API key: on the first turn it calls create_entity, then answers.
export class StubAgentRuntime implements AgentRuntime {
  async run(prompt: AgentPrompt): Promise<AgentTurn> {
    const alreadyCreated = prompt.messages.some((m) => m.role === 'tool' && m.content.startsWith('create_entity'))
    if (!alreadyCreated && prompt.tools.includes('create_entity')) {
      return {
        text: null,
        toolCalls: [{ id: 't1', name: 'create_entity', input: { name: 'Leads' } }],
      }
    }
    return { text: 'Done. I created the "Leads" entity for you.', toolCalls: [] }
  }
}
