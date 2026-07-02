import { JsonObject } from '@/shared/domain/Json'
import { Skill } from '@/contexts/skills/domain/Skill'
import { SkillId } from '@/contexts/skills/domain/ids'
import { Guardrails } from '@/contexts/skills/domain/Guardrails'

// Semi-decoded persistence row: `toolIds` / `systemToolNames` are already parsed
// string arrays and `guardrails` is a parsed JSON object here. The Drizzle adapter
// owns the final encoding (JSON.stringify of all three text columns), so the
// mapper never touches the DB text format.
export interface SkillRow {
  id: string
  name: string
  slug: string
  description: string | null
  systemPrompt: string
  toolIds: string[]
  systemToolNames: string[]
  guardrails: JsonObject
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

export const SkillMapper = {
  toPersistence(skill: Skill): SkillRow {
    return {
      id: skill.id.value,
      name: skill.name,
      slug: skill.slug,
      description: skill.description,
      systemPrompt: skill.systemPrompt,
      toolIds: [...skill.toolIds],
      systemToolNames: [...skill.systemToolNames],
      guardrails: skill.guardrails.toJSON(),
      createdBy: skill.createdBy,
      createdAt: skill.createdAt,
      updatedAt: skill.updatedAt,
    }
  },

  toDomain(row: SkillRow): Skill {
    return Skill.rehydrate({
      id: SkillId.of(row.id),
      name: row.name,
      slug: row.slug,
      description: row.description,
      systemPrompt: row.systemPrompt,
      toolIds: row.toolIds,
      systemToolNames: row.systemToolNames,
      guardrails: Guardrails.fromJSON(row.guardrails),
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })
  },
}
