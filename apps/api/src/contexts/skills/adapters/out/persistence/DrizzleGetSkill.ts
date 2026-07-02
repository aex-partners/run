import { eq } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { skills } from '@/platform/db/schema'
import { GetSkill, GetSkillOptions } from '@/contexts/skills/application/ports/in/GetSkill'
import { SkillView } from '@/contexts/skills/application/queries/SkillView'
import { toSkillView } from '@/contexts/skills/adapters/out/persistence/skillReadMapping'

// Driven read-side adapter (CQRS). Source router `getById` — null when absent.
export class DrizzleGetSkill implements GetSkill {
  constructor(private readonly db: Database) {}

  async execute(opts: GetSkillOptions): Promise<SkillView | null> {
    const [row] = await this.db.select().from(skills).where(eq(skills.id, opts.id)).limit(1)
    return row ? toSkillView(row) : null
  }
}
