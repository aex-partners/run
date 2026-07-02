import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { ForwardMessages, ForwardMessagesCommand } from '@/contexts/conversations/application/ports/in/ForwardMessages'
import { MessageRepository } from '@/contexts/conversations/application/ports/out/MessageRepository'
import { ConversationMemberRepository } from '@/contexts/conversations/application/ports/out/ConversationMemberRepository'
import { AuthorDirectory } from '@/contexts/conversations/application/ports/out/AuthorDirectory'
import { Message } from '@/contexts/conversations/domain/Message'
import { MessageId, ConversationId } from '@/contexts/conversations/domain/ids'
import { buildMetadata } from '@/contexts/conversations/domain/MessageMetadata'
import { AccessPolicy } from '@/contexts/conversations/domain/services/AccessPolicy'

interface Original {
  id: string
  content: string
  authorName: string
}

// Forwards messages into other conversations. Guards membership on BOTH ends: the
// source conversation of each forwarded message (anti-IDOR) and every recipient.
// Each copy is stamped with the original author's resolved display name.
export class ForwardMessagesService implements ForwardMessages {
  constructor(
    private readonly messages: MessageRepository,
    private readonly members: ConversationMemberRepository,
    private readonly authors: AuthorDirectory,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: ForwardMessagesCommand): Promise<Result<{ success: true }>> {
    // Collect the originals, guarding source membership.
    const originals: Original[] = []
    for (const messageId of cmd.messageIds) {
      const msg = await this.messages.findById(MessageId.of(messageId))
      if (!msg) continue
      const member = await this.members.findMember(ConversationId.of(msg.conversationId), cmd.actorId)
      const guard = AccessPolicy.requireMember(member)
      if (!guard.ok) return fail(guard.error)
      const authorName = (await this.authors.displayName(msg.authorId, msg.agentId)) ?? 'Unknown'
      originals.push({ id: msg.id.value, content: msg.content, authorName })
    }

    // Post a copy into each recipient conversation (membership-guarded).
    for (const conversationId of cmd.recipientConversationIds) {
      const convId = ConversationId.of(conversationId)
      const member = await this.members.findMember(convId, cmd.actorId)
      const guard = AccessPolicy.requireMember(member)
      if (!guard.ok) return fail(guard.error)

      const memberIds = await this.members.listMemberIds(convId)
      const recipientIds = memberIds.filter((id) => id !== cmd.actorId)

      const copies: Message[] = []
      for (const orig of originals) {
        const metadata = buildMetadata({
          forwardedFrom: { messageId: orig.id, authorName: orig.authorName },
        })
        const id = this.messages.nextId()
        const copy = Message.post({
          id,
          conversationId,
          authorId: cmd.actorId,
          agentId: null,
          content: orig.content,
          role: 'user',
          metadata,
          audio: null,
          recipientIds,
          now: this.clock.now(),
        })
        if (!copy.ok) return fail(copy.error)
        copies.push(copy.value)
      }

      await this.messages.saveMany(copies)
      for (const copy of copies) {
        await this.events.publish(copy.pullEvents())
      }
    }

    return ok({ success: true })
  }
}
