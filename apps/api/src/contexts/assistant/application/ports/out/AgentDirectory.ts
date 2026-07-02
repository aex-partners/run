import { AgentConfig } from '@/contexts/assistant/domain/AgentConfig'

// ACL out-port -> the agents/skills contexts (+ prompt assembly). Resolves the
// agent bound to a conversation into a full AgentConfig: identity, the assembled
// system prompt, model, and the union of agent/skill tool ids. Ported from
// agent-resolver.ts + prompts.ts. main bridges this to the agents context (today
// an adapter reads the platform `agents`/`skills`/`settings` tables directly and
// composes the prompt via domain's assembleSystemPrompt).
export interface AgentDirectory {
  resolve(conversationId: string, userId: string): Promise<AgentConfig>
}
