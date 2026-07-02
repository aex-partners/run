import { Result, ok, fail } from '@/shared/kernel/Result'
import { ConversationMember } from '@/contexts/conversations/domain/ConversationMember'

// PURE domain rules guarding who may act on a conversation/message. The use cases
// fetch the membership row (IO) then run these to decide. Keeping the decision
// here, not in the controller, makes the authorization rule testable in isolation.
export const AccessPolicy = {
  // Only members may read or post into a conversation (source: FORBIDDEN otherwise).
  requireMember(member: ConversationMember | null): Result<ConversationMember> {
    return member ? ok(member) : fail('Not a member of this conversation')
  },
}
