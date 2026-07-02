import { Result, ok, fail } from '@/shared/kernel/Result'
import {
  DeleteMessagesForMe,
  DeleteMessagesForMeCommand,
} from '@/contexts/conversations/application/ports/in/DeleteMessagesForMe'
import { MessageRepository } from '@/contexts/conversations/application/ports/out/MessageRepository'
import { ConversationMemberRepository } from '@/contexts/conversations/application/ports/out/ConversationMemberRepository'
import { MessageId, ConversationId } from '@/contexts/conversations/domain/ids'
import { AccessPolicy } from '@/contexts/conversations/domain/services/AccessPolicy'

// Hides messages for the caller only (adds them to each message's deletedFor).
// Membership-guarded per message. No WS event (other members are unaffected).
export class DeleteMessagesForMeService implements DeleteMessagesForMe {
  constructor(
    private readonly messages: MessageRepository,
    private readonly members: ConversationMemberRepository,
  ) {}

  async execute(cmd: DeleteMessagesForMeCommand): Promise<Result<{ success: true }>> {
    for (const messageId of cmd.messageIds) {
      const message = await this.messages.findById(MessageId.of(messageId))
      if (!message) continue

      const member = await this.members.findMember(ConversationId.of(message.conversationId), cmd.userId)
      const guard = AccessPolicy.requireMember(member)
      if (!guard.ok) return fail(guard.error)

      message.deleteForMe(cmd.userId)
      await this.messages.save(message)
    }
    return ok({ success: true })
  }
}
