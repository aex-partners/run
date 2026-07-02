import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { EnsureEric, EnsureEricCommand } from '@/contexts/conversations/application/ports/in/EnsureEric'
import { ConversationRepository } from '@/contexts/conversations/application/ports/out/ConversationRepository'
import { ConversationMemberRepository } from '@/contexts/conversations/application/ports/out/ConversationMemberRepository'
import { AgentDirectory } from '@/contexts/conversations/application/ports/out/AgentDirectory'
import { Conversation } from '@/contexts/conversations/domain/Conversation'

// Application service for the Eric-ensure rule. Resolves the "eric" agent (ACL ->
// assistant/agents), then finds-or-creates the caller's private AI conversation
// bound to it. Fails if no Eric agent exists (source returns NOT_FOUND).
export class EnsureEricService implements EnsureEric {
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly members: ConversationMemberRepository,
    private readonly agents: AgentDirectory,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: EnsureEricCommand): Promise<Result<{ id: string }>> {
    const agentId = await this.agents.ericAgentId()
    if (!agentId) return fail('Eric agent not found')

    const existing = await this.conversations.findEricConversation(agentId, cmd.userId)
    if (existing) return ok({ id: existing.value })

    const id = this.conversations.nextId()
    const conversation = Conversation.createEric({
      id,
      agentId,
      userId: cmd.userId,
      now: this.clock.now(),
    })

    await this.conversations.save(conversation)
    await this.members.add(id, conversation.members())
    await this.events.publish(conversation.pullEvents())

    return ok({ id: id.value })
  }
}
