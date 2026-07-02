import { SkillView } from '@/contexts/skills/application/queries/SkillView'

// Driving port (read). Source router `getById` — returns null when absent.
export interface GetSkillOptions {
  id: string
}

export interface GetSkill {
  execute(opts: GetSkillOptions): Promise<SkillView | null>
}
