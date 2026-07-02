import { Result, ok } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { CreateConversation, CreateConversationCommand } from '@/contexts/conversations/application/ports/in/CreateConversation'
import { ConversationView } from '@/contexts/conversations/application/queries/GetConversation'
import { ConversationRepository } from '@/contexts/conversations/application/ports/out/ConversationRepository'
import { ConversationMemberRepository } from '@/contexts/conversations/application/ports/out/ConversationMemberRepository'
import { ConversationMapper } from '@/contexts/conversations/application/mappers/ConversationMapper'
import { Conversation } from '@/contexts/conversations/domain/Conversation'

// Application service. Builds the conversation aggregate (creator + distinct
// members), persists the row and its member rows, publishes events. The dedup
// rules for DM/Eric live in their own use cases; this is the plain group/ai create.
export class CreateConversationService implements CreateConversation {
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly members: ConversationMemberRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: CreateConversationCommand): Promise<Result<ConversationView>> {
    const id = this.conversations.nextId()
    const conversation = Conversation.create({
      id,
      name: cmd.name ?? null,
      type: cmd.type,
      creatorId: cmd.creatorId,
      memberIds: cmd.memberIds ?? [],
      now: this.clock.now(),
    })

    await this.conversations.save(conversation)
    await this.members.add(id, conversation.members())
    await this.events.publish(conversation.pullEvents())

    return ok(ConversationMapper.toView(conversation))
  }
}
