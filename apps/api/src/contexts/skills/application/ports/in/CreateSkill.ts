import { Result } from '@/shared/kernel/Result'
import { GuardrailsValue } from '@/contexts/skills/domain/Guardrails'

// Driving port. Plain-data command in, plain-data out — no domain object crosses
// the boundary. Mirrors the source router `create`; `createdBy` is supplied by
// main from the authenticated context.
export interface CreateSkillCommand {
  name: string
  description?: string | null
  systemPrompt: string
  toolIds?: string[]
  systemToolNames?: string[]
  guardrails?: GuardrailsValue
  createdBy: string
}

export interface CreateSkill {
  execute(cmd: CreateSkillCommand): Promise<Result<{ id: string; slug: string }>>
}
