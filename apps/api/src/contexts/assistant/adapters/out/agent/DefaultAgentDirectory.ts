import { AgentDirectory } from '@/contexts/assistant/application/ports/out/AgentDirectory'
import { AgentConfig, DEFAULT_AGENT_ID, DEFAULT_AGENT_NAME } from '@/contexts/assistant/domain/AgentConfig'
import { assembleSystemPrompt } from '@/contexts/assistant/domain/SystemPrompt'

// Default driven adapter for AgentDirectory: always resolves to the built-in Eric
// with the static base system prompt. It depends only on the domain (no platform,
// no cross-context), so the assistant context is runnable before the agents/skills
// contexts exist. main replaces it with a DB-backed ACL bridge (resolve the bound
// agent + skills, gather live company/knowledge/entity context, then call
// domain's assembleSystemPrompt) once those contexts expose in-ports.
export class DefaultAgentDirectory implements AgentDirectory {
  async resolve(_conversationId: string, _userId: string): Promise<AgentConfig> {
    return {
      id: DEFAULT_AGENT_ID,
      name: DEFAULT_AGENT_NAME,
      systemPrompt: assembleSystemPrompt({ agentName: DEFAULT_AGENT_NAME }),
      modelId: null,
      toolIds: [],
      skillPrompts: [],
    }
  }
}
