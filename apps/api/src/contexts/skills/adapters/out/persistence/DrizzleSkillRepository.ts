import { randomUUID } from 'node:crypto'
import { and, eq, ne } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { skills } from '@/platform/db/schema'
import { SkillRepository } from '@/contexts/skills/application/ports/out/SkillRepository'
import { Skill } from '@/contexts/skills/domain/Skill'
import { SkillId } from '@/contexts/skills/domain/ids'
import { SkillMapper } from '@/contexts/skills/application/mappers/SkillMapper'
import {
  parseStringArray,
  parseJsonObject,
} from '@/contexts/skills/adapters/out/persistence/skillReadMapping'

// Driven adapter. Stores the aggregate in the `skills` table. `save` upserts
// (create + every update land here). This adapter owns the on-disk encoding the
// mapper deliberately ignores: `toolIds`, `systemToolNames` and `guardrails` are
// JSON text columns (source contract).
export class DrizzleSkillRepository implements SkillRepository {
  constructor(private readonly db: Database) {}

  nextId(): SkillId {
    return SkillId.of(randomUUID())
  }

  async findById(id: SkillId): Promise<Skill | null> {
    const [row] = await this.db.select().from(skills).where(eq(skills.id, id.value)).limit(1)
    if (!row) return null
    return SkillMapper.toDomain({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      systemPrompt: row.systemPrompt,
      toolIds: parseStringArray(row.toolIds),
      systemToolNames: parseStringArray(row.systemToolNames),
      guardrails: parseJsonObject(row.guardrails),
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })
  }

  // Backs the slug-uniqueness invariant. `excludeId` lets an update keep its own
  // slug while rejecting collisions with any OTHER skill.
  async existsBySlug(slug: string, excludeId?: string): Promise<boolean> {
    const where =
      excludeId === undefined ? eq(skills.slug, slug) : and(eq(skills.slug, slug), ne(skills.id, excludeId))
    const rows = await this.db.select({ id: skills.id }).from(skills).where(where).limit(1)
    return rows.length > 0
  }

  async save(skill: Skill): Promise<void> {
    const row = SkillMapper.toPersistence(skill)
    const toolIds = JSON.stringify(row.toolIds)
    const systemToolNames = JSON.stringify(row.systemToolNames)
    const guardrails = JSON.stringify(row.guardrails)

    await this.db
      .insert(skills)
      .values({
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        systemPrompt: row.systemPrompt,
        toolIds,
        systemToolNames,
        guardrails,
        createdBy: row.createdBy,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })
      .onConflictDoUpdate({
        target: skills.id,
        set: {
          name: row.name,
          slug: row.slug,
          description: row.description,
          systemPrompt: row.systemPrompt,
          toolIds,
          systemToolNames,
          guardrails,
          updatedAt: row.updatedAt,
        },
      })
  }

  async delete(id: SkillId): Promise<void> {
    await this.db.delete(skills).where(eq(skills.id, id.value))
  }
}
