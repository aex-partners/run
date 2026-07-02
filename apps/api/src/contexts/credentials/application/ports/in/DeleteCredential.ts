import { Result } from '@/shared/kernel/Result'

// Driving port. `userId` scopes the delete to the owner. A non-owned or missing
// id is a silent no-op, matching the source.
export interface DeleteCredentialCommand {
  id: string
  userId: string
}

export interface DeleteCredential {
  execute(cmd: DeleteCredentialCommand): Promise<Result<{ success: true }>>
}
