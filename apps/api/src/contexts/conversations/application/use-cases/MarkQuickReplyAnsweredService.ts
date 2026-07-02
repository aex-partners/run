import { Result, ok } from '@/shared/kernel/Result'
import {
  MarkQuickReplyAnswered,
  MarkQuickReplyAnsweredCommand,
} from '@/contexts/conversations/application/ports/in/MarkQuickReplyAnswered'
import { MessageRepository } from '@/contexts/conversations/application/ports/out/MessageRepository'
import { MessageId } from '@/contexts/conversations/domain/ids'

// Flags a message's quick-reply block as answered. Lenient: a missing message or
// absent block is still a success (no-op), matching the source.
export class MarkQuickReplyAnsweredService implements MarkQuickReplyAnswered {
  constructor(private readonly messages: MessageRepository) {}

  async execute(cmd: MarkQuickReplyAnsweredCommand): Promise<Result<{ success: true }>> {
    const message = await this.messages.findById(MessageId.of(cmd.messageId))
    if (message) {
      message.markQuickReplyAnswered()
      await this.messages.save(message)
    }
    return ok({ success: true })
  }
}
