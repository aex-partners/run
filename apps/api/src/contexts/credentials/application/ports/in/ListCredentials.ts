import { CredentialType } from '@/contexts/credentials/domain/CredentialType'
import { CredentialStatus } from '@/contexts/credentials/domain/CredentialStatus'

// Read side (CQRS). Bypasses the aggregate: an adapter answers it with a direct
// query. The secret `value` is NEVER returned — only `hasValue` (whether a secret
// is set), mirroring the source router stripping `value` from list results.
export interface CredentialView {
  id: string
  name: string
  pluginName: string
  type: CredentialType
  status: CredentialStatus
  isPrimary: boolean
  hasValue: boolean
  createdAt: Date
  updatedAt: Date
}

export interface ListCredentialsQuery {
  userId: string
  // Optional filter: when set, only the owner's credentials for this plugin are
  // returned (backs the `getByPlugin` read). Absent => all of the owner's.
  pluginName?: string
}

export interface ListCredentials {
  execute(query: ListCredentialsQuery): Promise<CredentialView[]>
}
