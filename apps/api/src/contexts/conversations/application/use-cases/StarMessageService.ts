import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { StarMessage, StarMessageCommand } from '@/contexts/conversations/application/ports/in/StarMessage'
import { MessageRepository } from '@/contexts/conversations/application/ports/out/MessageRepository'
import { ConversationMemberRepository } from '@/contexts/conversations/application/ports/out/ConversationMemberRepository'
import { MessageId, ConversationId } from '@/contexts/conversations/domain/ids'
import { AccessPolicy } from '@/contexts/conversations/domain/services/AccessPolicy'

// Toggles a message's starred flag (personal, but membership-guarded; the WS
// update stays scoped to members).
export class StarMessageService implements StarMessage {
  constructor(
    private readonly messages: MessageRepository,
    private readonly members: ConversationMemberRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: StarMessageCommand): Promise<Result<{ success: true; starred: boolean }>> {
    const message = await this.messages.findById(MessageId.of(cmd.messageId))
    if (!message) return fail('Message not found')

    const convId = ConversationId.of(message.conversationId)
    const member = await this.members.findMember(convId, cmd.userId)
    const guard = AccessPolicy.requireMember(member)
    if (!guard.ok) return fail(guard.error)

    const memberIds = await this.members.listMemberIds(convId)
    const starred = message.toggleStar(memberIds, this.clock.now())

    await this.messages.save(message)
    await this.events.publish(message.pullEvents())

    return ok({ success: true, starred })
  }
}
