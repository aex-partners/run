import { Result } from '@/shared/kernel/Result'

// Admin renames another user. Mirrors users.updateName.
export interface RenameUserCommand {
  actorId: string
  userId: string
  name: string
}

export interface RenameUser {
  execute(cmd: RenameUserCommand): Promise<Result<{ success: true }>>
}
