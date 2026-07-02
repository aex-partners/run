import { Agent } from '@/contexts/agents/domain/Agent'

// A skill's contribution to a resolved agent, supplied already loaded by the
// caller. Skills are a SEPARATE bounded context: the agents context never reads
// them; it only applies the merge rule over fragments handed in.
export interface SkillFragment {
  systemPrompt: string | null
  toolIds: string[]
}

// The pure result of resolving an agent for a conversation/run: the prompt
// fragments to stitch together, the model to use, the deduped tool set, and the
// skill ids the agent composes (so a caller can expand them if it didn't already).
export interface ResolvedAgent {
  id: string
  name: string
  modelId: string | null
  systemPromptFragments: string[]
  toolIds: string[]
  skillIds: string[]
}

// Identity of the implicit fallback agent when a conversation has none.
export const DEFAULT_AGENT_ID = 'default'

// Pure domain rules behind AEX's resolveAgentForConversation: no agent -> the
// named default; otherwise merge the agent's prompt with each skill's prompt and
// collect every tool id (agent + skills), deduped. Zero IO, zero npm — the DB
// lookups (conversation -> agentId, skill loading) live in the adapters/service.
export const AgentResolver = {
  resolve(agent: Agent | null, skills: SkillFragment[], defaultName: string): ResolvedAgent {
    if (!agent) {
      return {
        id: DEFAULT_AGENT_ID,
        name: defaultName,
        modelId: null,
        systemPromptFragments: [],
        toolIds: [],
        skillIds: [],
      }
    }

    const systemPromptFragments: string[] = []
    const toolIds: string[] = [...agent.toolIds]
    if (agent.systemPrompt) systemPromptFragments.push(agent.systemPrompt)

    for (const skill of skills) {
      if (skill.systemPrompt) systemPromptFragments.push(skill.systemPrompt)
      toolIds.push(...skill.toolIds)
    }

    return {
      id: agent.id.value,
      name: agent.name,
      modelId: agent.modelId,
      systemPromptFragments,
      toolIds: [...new Set(toolIds)],
      skillIds: [...agent.skillIds],
    }
  },
}
