import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import {
  AppendMessage,
  AppendMessageCommand,
  AppendMessageResult,
} from '@/contexts/conversations/application/ports/in/AppendMessage'
import { MessageRepository } from '@/contexts/conversations/application/ports/out/MessageRepository'
import { ConversationMemberRepository } from '@/contexts/conversations/application/ports/out/ConversationMemberRepository'
import { AttachmentResolver } from '@/contexts/conversations/application/ports/out/AttachmentResolver'
import { Message, AudioPayload } from '@/contexts/conversations/domain/Message'
import { ConversationId } from '@/contexts/conversations/domain/ids'
import { buildMetadata } from '@/contexts/conversations/domain/MessageMetadata'

// Generic post-into-a-conversation service. Backs `send`/`sendAudio` AND the
// programmatic posts other contexts make via PostSystemMessage. Membership is
// enforced only when `requireMembership` is set and an author is present (human
// send); system/AI posts skip it. Attachments are shared to members via the file
// ACL (no-op unless the author owns the file). The MessagePosted event carries the
// fan-out audience (members minus the author) for the WS adapter.
export class AppendMessageService implements AppendMessage {
  constructor(
    private readonly messages: MessageRepository,
    private readonly members: ConversationMemberRepository,
    private readonly attachments: AttachmentResolver,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: AppendMessageCommand): Promise<Result<AppendMessageResult>> {
    const convId = ConversationId.of(cmd.conversationId)
    const memberIds = await this.members.listMemberIds(convId)

    if (cmd.requireMembership && cmd.authorId && !memberIds.includes(cmd.authorId)) {
      return fail('Not a member of this conversation')
    }

    // Grant the other members read access to each attachment (only meaningful for an
    // authored send). The files context owns the grant policy (e.g. only files the
    // sender owns); conversations just declares the audience.
    if (cmd.attachments && cmd.attachments.length > 0 && cmd.authorId) {
      const fileIds = cmd.attachments.map((att) => att.fileId)
      const otherMembers = memberIds.filter((id) => id !== cmd.authorId)
      await this.attachments.grant(fileIds, otherMembers)
    }

    const metadata = buildMetadata({
      replyTo: cmd.replyTo,
      attachments: cmd.attachments,
      forwardedFrom: cmd.forwardedFrom,
    })

    const audio: AudioPayload | null = cmd.audio
      ? {
          url: cmd.audio.url,
          duration: cmd.audio.duration,
          waveform: cmd.audio.waveform ?? null,
          transcription: cmd.audio.transcription ?? null,
          transcriptionEdited: false,
        }
      : null

    const recipientIds = cmd.authorId ? memberIds.filter((id) => id !== cmd.authorId) : memberIds

    const id = this.messages.nextId()
    const message = Message.post({
      id,
      conversationId: cmd.conversationId,
      authorId: cmd.authorId,
      agentId: cmd.agentId ?? null,
      content: cmd.content,
      role: cmd.role,
      metadata,
      audio,
      recipientIds,
      now: this.clock.now(),
    })
    if (!message.ok) return fail(message.error)

    await this.messages.save(message.value)
    await this.events.publish(message.value.pullEvents())

    return ok({
      id: id.value,
      conversationId: cmd.conversationId,
      authorId: cmd.authorId,
      authorName: cmd.authorName ?? null,
      content: message.value.content,
      role: message.value.role,
      createdAt: message.value.createdAt,
    })
  }
}
