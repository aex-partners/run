import { Result, ok, fail } from '@/shared/kernel/Result'
import { DeleteConversation, DeleteConversationCommand } from '@/contexts/conversations/application/ports/in/DeleteConversation'
import { ConversationRepository } from '@/contexts/conversations/application/ports/out/ConversationRepository'
import { ConversationMemberRepository } from '@/contexts/conversations/application/ports/out/ConversationMemberRepository'
import { ConversationId } from '@/contexts/conversations/domain/ids'
import { AccessPolicy } from '@/contexts/conversations/domain/services/AccessPolicy'

// Hard-deletes a conversation (FK cascade drops members + messages). Membership-guarded.
export class DeleteConversationService implements DeleteConversation {
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly members: ConversationMemberRepository,
  ) {}

  async execute(cmd: DeleteConversationCommand): Promise<Result<{ success: true }>> {
    const convId = ConversationId.of(cmd.id)
    const actor = await this.members.findMember(convId, cmd.actorId)
    const guard = AccessPolicy.requireMember(actor)
    if (!guard.ok) return fail(guard.error)

    await this.conversations.delete(convId)
    return ok({ success: true })
  }
}
