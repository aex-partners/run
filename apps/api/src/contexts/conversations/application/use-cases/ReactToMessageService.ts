import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { ReactToMessage, ReactToMessageCommand } from '@/contexts/conversations/application/ports/in/ReactToMessage'
import { MessageRepository } from '@/contexts/conversations/application/ports/out/MessageRepository'
import { ConversationMemberRepository } from '@/contexts/conversations/application/ports/out/ConversationMemberRepository'
import { Reaction } from '@/contexts/conversations/domain/Reaction'
import { MessageId, ConversationId } from '@/contexts/conversations/domain/ids'
import { AccessPolicy } from '@/contexts/conversations/domain/services/AccessPolicy'

// Toggles the caller's emoji reaction on a message and broadcasts the new set.
export class ReactToMessageService implements ReactToMessage {
  constructor(
    private readonly messages: MessageRepository,
    private readonly members: ConversationMemberRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: ReactToMessageCommand): Promise<Result<{ success: true; reactions: Reaction[] }>> {
    const message = await this.messages.findById(MessageId.of(cmd.messageId))
    if (!message) return fail('Message not found')

    const convId = ConversationId.of(message.conversationId)
    const member = await this.members.findMember(convId, cmd.userId)
    const guard = AccessPolicy.requireMember(member)
    if (!guard.ok) return fail(guard.error)

    const memberIds = await this.members.listMemberIds(convId)
    const reactions = message.react(cmd.userId, cmd.emoji, memberIds, this.clock.now())

    await this.messages.save(message)
    await this.events.publish(message.pullEvents())

    return ok({ success: true, reactions })
  }
}
