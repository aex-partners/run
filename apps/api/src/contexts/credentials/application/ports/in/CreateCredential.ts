import { Result } from '@/shared/kernel/Result'
import { JsonObject } from '@/shared/domain/Json'
import { CredentialType } from '@/contexts/credentials/domain/CredentialType'

// Driving port. Plain-data command in, plain-data out — no domain object crosses
// the boundary.
export interface CreateCredentialCommand {
  name: string
  pluginName: string
  type: CredentialType
  value: JsonObject
  userId: string
}

export interface CreateCredential {
  execute(cmd: CreateCredentialCommand): Promise<Result<{ id: string }>>
}
