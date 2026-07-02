import { SkillView } from '@/contexts/skills/application/queries/SkillView'

// Driving port (read). Source router `list` is org-wide, not user-scoped.
export interface ListSkills {
  execute(): Promise<SkillView[]>
}
