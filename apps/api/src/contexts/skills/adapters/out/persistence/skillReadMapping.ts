import { JsonObject } from '@/shared/domain/Json'
import { Guardrails } from '@/contexts/skills/domain/Guardrails'
import { SkillView } from '@/contexts/skills/application/queries/SkillView'

// The stored `skills` row: the three dynamic columns (`toolIds`,
// `systemToolNames`, `guardrails`) are still JSON text here — this module owns
// decoding them for the read side.
export interface SkillTextRow {
  id: string
  name: string
  slug: string
  description: string | null
  systemPrompt: string
  toolIds: string
  systemToolNames: string
  guardrails: string
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

// Parse a stored JSON text array of strings; defaults to [] on malformed input.
export function parseStringArray(text: string): string[] {
  try {
    const parsed: unknown = JSON.parse(text)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x): x is string => typeof x === 'string')
  } catch {
    return []
  }
}

// Parse the stored guardrails JSON object; defaults to {} on malformed input.
export function parseJsonObject(text: string): JsonObject {
  try {
    const parsed: unknown = JSON.parse(text)
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as JsonObject)
      : {}
  } catch {
    return {}
  }
}

// Project a stored row into the read model. Guardrails round-trips through the VO
// so the view carries the coerced, canonical shape.
export function toSkillView(row: SkillTextRow): SkillView {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    systemPrompt: row.systemPrompt,
    toolIds: parseStringArray(row.toolIds),
    systemToolNames: parseStringArray(row.systemToolNames),
    guardrails: Guardrails.fromJSON(parseJsonObject(row.guardrails)).toValue(),
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}
