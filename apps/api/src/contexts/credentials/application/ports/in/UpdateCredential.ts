import { Result } from '@/shared/kernel/Result'
import { JsonObject } from '@/shared/domain/Json'
import { CredentialStatus } from '@/contexts/credentials/domain/CredentialStatus'

// Driving port. `userId` scopes the edit to the owner (source: WHERE created_by =
// user). A non-owned or missing id is a silent no-op, matching the source.
export interface UpdateCredentialCommand {
  id: string
  userId: string
  name?: string
  value?: JsonObject
  status?: CredentialStatus
}

export interface UpdateCredential {
  execute(cmd: UpdateCredentialCommand): Promise<Result<{ success: true }>>
}
