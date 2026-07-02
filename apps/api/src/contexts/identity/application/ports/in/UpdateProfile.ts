import { Result } from '@/shared/kernel/Result'

// Self-service name change. Scoped to the caller via userId (the session id); it
// takes no target id so a user can only ever edit their own record. Mirrors
// profile.updateName.
export interface UpdateProfileCommand {
  userId: string
  name: string
}

export interface UpdateProfile {
  execute(cmd: UpdateProfileCommand): Promise<Result<{ success: true }>>
}
