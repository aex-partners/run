import { Result, ok, fail } from '@/shared/kernel/Result'
import { EditTranscription, EditTranscriptionCommand } from '@/contexts/conversations/application/ports/in/EditTranscription'
import { MessageRepository } from '@/contexts/conversations/application/ports/out/MessageRepository'
import { MessageId } from '@/contexts/conversations/domain/ids'

// Author-only edit of an audio transcription.
export class EditTranscriptionService implements EditTranscription {
  constructor(private readonly messages: MessageRepository) {}

  async execute(cmd: EditTranscriptionCommand): Promise<Result<{ success: true }>> {
    const message = await this.messages.findById(MessageId.of(cmd.messageId))
    if (!message) return fail('Message not found')

    const edited = message.editTranscription(cmd.userId, cmd.transcription)
    if (!edited.ok) return fail(edited.error)

    await this.messages.save(message)
    return ok({ success: true })
  }
}
