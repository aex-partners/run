import { Database } from '@/platform/db/client'
import { skills } from '@/platform/db/schema'
import { ListSkills } from '@/contexts/skills/application/ports/in/ListSkills'
import { SkillView } from '@/contexts/skills/application/queries/SkillView'
import { toSkillView } from '@/contexts/skills/adapters/out/persistence/skillReadMapping'

// Driven read-side adapter (CQRS). Answers ListSkills with a direct SELECT — no
// aggregate, no mapper round-trip (source router `list`, org-wide).
export class DrizzleListSkills implements ListSkills {
  constructor(private readonly db: Database) {}

  async execute(): Promise<SkillView[]> {
    const rows = await this.db.select().from(skills)
    return rows.map((row) => toSkillView(row))
  }
}
