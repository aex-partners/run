import { GuardrailsValue } from '@/contexts/skills/domain/Guardrails'

// Read side (CQRS). The full skill row projected for the UI — what the source
// router `list` / `getById` return. An adapter answers it with a direct SELECT;
// no aggregate, no mapper round-trip.
export interface SkillView {
  id: string
  name: string
  slug: string
  description: string | null
  systemPrompt: string
  toolIds: string[]
  systemToolNames: string[]
  guardrails: GuardrailsValue
  createdBy: string
  createdAt: Date
  updatedAt: Date
}
