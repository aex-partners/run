import { Result } from '@/shared/kernel/Result'

export interface ChangeUserRoleCommand {
  actorId: string
  actorRole: string
  userId: string
  role: string
}

export interface ChangeUserRole {
  execute(cmd: ChangeUserRoleCommand): Promise<Result<{ success: true }>>
}
