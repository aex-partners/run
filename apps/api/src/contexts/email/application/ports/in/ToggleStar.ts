import { Result } from '@/shared/kernel/Result'

// Driving port behind emails.star.
export interface ToggleStarCommand {
  actorId: string
  id: string
}

export interface ToggleStar {
  execute(cmd: ToggleStarCommand): Promise<Result<{ starred: boolean }>>
}
