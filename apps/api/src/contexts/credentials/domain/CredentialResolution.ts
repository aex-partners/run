import { CredentialStatus } from '@/contexts/credentials/domain/CredentialStatus'

// The minimal projection the resolution rule needs — no secret value, just the
// columns that decide precedence. Adapters map rows to this.
export interface CredentialCandidate {
  id: string
  isPrimary: boolean
  createdAt: Date
  status: CredentialStatus
}

// DOMAIN SERVICE — the credential resolution precedence as a PURE selector over a
// set. Mirrors the source's `resolveCredential`:
//
//   explicit id  >  primary  >  oldest
//
//   1. an explicitly requested id always wins (the caller chose it);
//   2. otherwise, among ACTIVE candidates, the one flagged primary wins;
//   3. ties / no primary fall back to the oldest (smallest createdAt).
//
// SQL equivalent: `WHERE status = 'active' ORDER BY is_primary DESC, created_at ASC`.
export const CredentialResolution = {
  select(candidates: readonly CredentialCandidate[], explicitId: string | null): CredentialCandidate | null {
    if (explicitId) {
      return candidates.find((c) => c.id === explicitId) ?? null
    }
    const active = candidates.filter((c) => c.status === 'active')
    const sorted = [...active].sort((a, b) => {
      if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1
      return a.createdAt.getTime() - b.createdAt.getTime()
    })
    return sorted[0] ?? null
  },
}
