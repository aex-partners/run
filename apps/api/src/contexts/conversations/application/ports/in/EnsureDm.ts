import { Result } from '@/shared/kernel/Result'

// Driving port. Finds or creates the 1:1 DM between two users, returning its id.
// Exposed for OTHER contexts too: the identity invite flow calls this to open a
// DM with a freshly invited user. Deduplicated by the unordered pair.
export interface EnsureDmCommand {
  userId: string
  peerUserId: string
}

export interface EnsureDm {
  execute(cmd: EnsureDmCommand): Promise<Result<{ id: string }>>
}
