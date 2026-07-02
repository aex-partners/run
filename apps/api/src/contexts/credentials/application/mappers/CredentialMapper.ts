import { JsonObject } from '@/shared/domain/Json'
import { Credential } from '@/contexts/credentials/domain/Credential'
import { CredentialId } from '@/contexts/credentials/domain/ids'
import { CredentialType } from '@/contexts/credentials/domain/CredentialType'
import { CredentialStatus } from '@/contexts/credentials/domain/CredentialStatus'

// Persistence row: the on-disk shape of the `credentials` table, EXCEPT `value`
// which is the already-decrypted JSON bag. The repository adapter owns the
// encryption boundary (string column <-> JsonObject via the Cipher port), so the
// mapper stays pure and crypto-free.
export interface CredentialRow {
  id: string
  name: string
  pluginName: string
  type: CredentialType
  status: CredentialStatus
  isPrimary: boolean
  value: JsonObject
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
}

export const CredentialMapper = {
  toPersistence(credential: Credential): CredentialRow {
    return {
      id: credential.id.value,
      name: credential.name,
      pluginName: credential.pluginName,
      type: credential.type,
      status: credential.status,
      isPrimary: credential.isPrimary,
      value: credential.value,
      createdBy: credential.createdBy,
      createdAt: credential.createdAt,
      updatedAt: credential.updatedAt,
    }
  },

  toDomain(row: CredentialRow): Credential {
    return Credential.rehydrate({
      id: CredentialId.of(row.id),
      name: row.name,
      pluginName: row.pluginName,
      type: row.type,
      status: row.status,
      isPrimary: row.isPrimary,
      value: row.value,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })
  },
}
