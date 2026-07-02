import { Skill } from '@/contexts/skills/domain/Skill'
import { SkillId } from '@/contexts/skills/domain/ids'

// Driven port. The application states WHAT it needs from persistence; an adapter
// under adapters/out implements HOW (Drizzle/Postgres, in-memory, ...).
// `existsBySlug` backs the slug-uniqueness invariant — a set-level/IO check the
// pure domain cannot perform itself; `excludeId` lets an update keep its own slug.
export interface SkillRepository {
  nextId(): SkillId
  findById(id: SkillId): Promise<Skill | null>
  existsBySlug(slug: string, excludeId?: string): Promise<boolean>
  save(skill: Skill): Promise<void>
  delete(id: SkillId): Promise<void>
}
