import { Result } from '@/shared/kernel/Result'

// Driving port. Hard delete (source router `delete`).
export interface DeleteSkillCommand {
  id: string
}

export interface DeleteSkill {
  execute(cmd: DeleteSkillCommand): Promise<Result<{ success: true }>>
}
