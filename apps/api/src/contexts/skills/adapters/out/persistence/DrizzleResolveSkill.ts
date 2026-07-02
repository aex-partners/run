import { eq } from 'drizzle-orm'
import { Result, ok } from '@/shared/kernel/Result'
import { Database } from '@/platform/db/client'
import { skills } from '@/platform/db/schema'
import {
  ResolveSkill,
  ResolveSkillQuery,
  ResolvedSkill,
} from '@/contexts/skills/application/ports/in/ResolveSkill'
import { Guardrails } from '@/contexts/skills/domain/Guardrails'
import {
  parseStringArray,
  parseJsonObject,
} from '@/contexts/skills/adapters/out/persistence/skillReadMapping'

// Driven read-side adapter fulfilling the assistant ACL in-port. Given a skill id,
// returns the system prompt, tool grants and guardrails the assistant folds into
// an agent; null when the skill no longer exists.
export class DrizzleResolveSkill implements ResolveSkill {
  constructor(private readonly db: Database) {}

  async execute(query: ResolveSkillQuery): Promise<Result<ResolvedSkill | null>> {
    const [row] = await this.db
      .select({
        id: skills.id,
        name: skills.name,
        slug: skills.slug,
        systemPrompt: skills.systemPrompt,
        toolIds: skills.toolIds,
        systemToolNames: skills.systemToolNames,
        guardrails: skills.guardrails,
      })
      .from(skills)
      .where(eq(skills.id, query.skillId))
      .limit(1)
    if (!row) return ok(null)

    return ok({
      id: row.id,
      slug: row.slug,
      name: row.name,
      systemPrompt: row.systemPrompt,
      toolIds: parseStringArray(row.toolIds),
      systemToolNames: parseStringArray(row.systemToolNames),
      guardrails: Guardrails.fromJSON(parseJsonObject(row.guardrails)).toValue(),
    })
  }
}
