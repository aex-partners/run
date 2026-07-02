import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { RenameConversation, RenameConversationCommand } from '@/contexts/conversations/application/ports/in/RenameConversation'
import { ConversationView } from '@/contexts/conversations/application/queries/GetConversation'
import { ConversationRepository } from '@/contexts/conversations/application/ports/out/ConversationRepository'
import { ConversationMemberRepository } from '@/contexts/conversations/application/ports/out/ConversationMemberRepository'
import { ConversationMapper } from '@/contexts/conversations/application/mappers/ConversationMapper'
import { ConversationId } from '@/contexts/conversations/domain/ids'
import { AccessPolicy } from '@/contexts/conversations/domain/services/AccessPolicy'

// Renames a conversation. Membership-guarded.
export class RenameConversationService implements RenameConversation {
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly members: ConversationMemberRepository,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: RenameConversationCommand): Promise<Result<ConversationView>> {
    const convId = ConversationId.of(cmd.id)
    const actor = await this.members.findMember(convId, cmd.actorId)
    const guard = AccessPolicy.requireMember(actor)
    if (!guard.ok) return fail(guard.error)

    const conversation = await this.conversations.findById(convId)
    if (!conversation) return fail('Conversation not found')

    const renamed = conversation.rename(cmd.name, this.clock.now())
    if (!renamed.ok) return fail(renamed.error)

    await this.conversations.save(conversation)
    return ok(ConversationMapper.toView(conversation))
  }
}
