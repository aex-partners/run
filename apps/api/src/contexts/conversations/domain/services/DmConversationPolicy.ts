import { createHash } from 'node:crypto'
import { Result, ok, fail } from '@/shared/kernel/Result'
import { ConversationId } from '@/contexts/conversations/domain/ids'

// PURE domain service for the DM de-duplication rule.
//
// A direct message is identified by the UNORDERED pair {userA, userB}. The
// primary dedup is a membership lookup (handled by the use case via the repo);
// this policy provides the deterministic fallback id so two concurrent creates
// converge on the same row (the repo persists it with on-conflict-do-nothing).
//
// The id derivation is a pure function of the sorted pair, identical to the
// source service: sha256("dm:lo:hi") truncated to 36 chars. `node:crypto` is a
// runtime builtin (not an npm package), so the framework-agnostic rule holds.
export const DmConversationPolicy = {
  // Invariant: you cannot DM yourself.
  ensureDistinct(userA: string, userB: string): Result<void> {
    return userA === userB ? fail('Cannot DM yourself') : ok(undefined)
  },

  deterministicId(userA: string, userB: string): Result<ConversationId> {
    const distinct = this.ensureDistinct(userA, userB)
    if (!distinct.ok) return fail(distinct.error)
    const [lo, hi] = [userA, userB].sort()
    const hash = createHash('sha256').update(`dm:${lo}:${hi}`).digest('hex').slice(0, 36)
    return ok(ConversationId.of(hash))
  },
}
