import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { SetConversationAgent, SetConversationAgentCommand } from '@/contexts/conversations/application/ports/in/SetConversationAgent'
import { ConversationView } from '@/contexts/conversations/application/queries/GetConversation'
import { ConversationRepository } from '@/contexts/conversations/application/ports/out/ConversationRepository'
import { ConversationMemberRepository } from '@/contexts/conversations/application/ports/out/ConversationMemberRepository'
import { ConversationMapper } from '@/contexts/conversations/application/mappers/ConversationMapper'
import { ConversationId } from '@/contexts/conversations/domain/ids'
import { AccessPolicy } from '@/contexts/conversations/domain/services/AccessPolicy'

// Binds (or clears) the AI agent on a conversation. Membership-guarded.
export class SetConversationAgentService implements SetConversationAgent {
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly members: ConversationMemberRepository,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: SetConversationAgentCommand): Promise<Result<ConversationView>> {
    const convId = ConversationId.of(cmd.conversationId)
    const actor = await this.members.findMember(convId, cmd.actorId)
    const guard = AccessPolicy.requireMember(actor)
    if (!guard.ok) return fail(guard.error)

    const conversation = await this.conversations.findById(convId)
    if (!conversation) return fail('Conversation not found')

    conversation.setAgent(cmd.agentId, this.clock.now())
    await this.conversations.save(conversation)
    return ok(ConversationMapper.toView(conversation))
  }
}
