import { Result } from '@/shared/kernel/Result'
import { GuardrailsValue } from '@/contexts/skills/domain/Guardrails'

// Driving port. Partial update of an existing skill (source router `update`).
// Any omitted field is left unchanged.
export interface UpdateSkillCommand {
  id: string
  name?: string
  description?: string | null
  systemPrompt?: string
  toolIds?: string[]
  systemToolNames?: string[]
  guardrails?: GuardrailsValue
}

export interface UpdateSkill {
  execute(cmd: UpdateSkillCommand): Promise<Result<{ id: string }>>
}
