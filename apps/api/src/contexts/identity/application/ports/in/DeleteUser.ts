import { Result } from '@/shared/kernel/Result'

export interface DeleteUserCommand {
  actorId: string
  userId: string
}

export interface DeleteUser {
  execute(cmd: DeleteUserCommand): Promise<Result<{ success: true }>>
}
