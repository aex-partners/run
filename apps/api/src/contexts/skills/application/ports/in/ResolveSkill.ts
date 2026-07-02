import { Result } from '@/shared/kernel/Result'
import { GuardrailsValue } from '@/contexts/skills/domain/Guardrails'

// The ready-to-use skill config the assistant composes into an agent: the system
// prompt to splice in, the tool grants, and the guardrails to enforce.
export interface ResolvedSkill {
  id: string
  slug: string
  name: string
  systemPrompt: string
  toolIds: string[]
  systemToolNames: string[]
  guardrails: GuardrailsValue
}

// Driving port consumed by the ASSISTANT context via an ACL in main (the same
// shape as credentials' ResolveCredential). The assistant must NOT import this
// context; main wires an agent's `skillIds` to this in-port, resolving each to a
// ResolvedSkill it folds into the system prompt + tool set. Returns null when the
// skill no longer exists.
export interface ResolveSkillQuery {
  skillId: string
}

export interface ResolveSkill {
  execute(query: ResolveSkillQuery): Promise<Result<ResolvedSkill | null>>
}
