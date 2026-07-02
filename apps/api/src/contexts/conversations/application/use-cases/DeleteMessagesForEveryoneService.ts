import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import {
  DeleteMessagesForEveryone,
  DeleteMessagesForEveryoneCommand,
} from '@/contexts/conversations/application/ports/in/DeleteMessagesForEveryone'
import { MessageRepository } from '@/contexts/conversations/application/ports/out/MessageRepository'
import { ConversationMemberRepository } from '@/contexts/conversations/application/ports/out/ConversationMemberRepository'
import { MessageId, ConversationId } from '@/contexts/conversations/domain/ids'

// Soft-deletes messages for everyone, author-only per message. Missing messages
// are skipped; a non-author attempt fails the whole call (mirrors the source's
// FORBIDDEN throw inside the loop).
export class DeleteMessagesForEveryoneService implements DeleteMessagesForEveryone {
  constructor(
    private readonly messages: MessageRepository,
    private readonly members: ConversationMemberRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: DeleteMessagesForEveryoneCommand): Promise<Result<{ success: true }>> {
    for (const messageId of cmd.messageIds) {
      const message = await this.messages.findById(MessageId.of(messageId))
      if (!message) continue

      const memberIds = await this.members.listMemberIds(ConversationId.of(message.conversationId))
      const deleted = message.deleteForEveryone(cmd.userId, memberIds, this.clock.now())
      if (!deleted.ok) return fail(deleted.error)

      await this.messages.save(message)
      await this.events.publish(message.pullEvents())
    }
    return ok({ success: true })
  }
}
