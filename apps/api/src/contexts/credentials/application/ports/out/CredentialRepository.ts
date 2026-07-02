import { Credential } from '@/contexts/credentials/domain/Credential'
import { CredentialId } from '@/contexts/credentials/domain/ids'
import { CredentialCandidate } from '@/contexts/credentials/domain/CredentialResolution'

// Driven port. The application states WHAT it needs from persistence; an adapter
// under adapters/out implements HOW (Drizzle/Postgres, in-memory, etc.). The
// adapter owns encryption-at-rest (via the Cipher port): aggregates returned here
// always carry the DECRYPTED value.
export interface CredentialRepository {
  nextId(): CredentialId
  findById(id: CredentialId): Promise<Credential | null>
  // Active credentials for a plugin, projected to the columns the resolution rule
  // needs (no secret value). Ordering is the rule's job, not the query's.
  findActiveCandidatesByPlugin(pluginName: string): Promise<CredentialCandidate[]>
  // Ids of every oauth2 credential — the scheduled refresh job's work list.
  listOAuth2Ids(): Promise<string[]>
  save(credential: Credential): Promise<void>
  delete(id: CredentialId): Promise<void>
}
