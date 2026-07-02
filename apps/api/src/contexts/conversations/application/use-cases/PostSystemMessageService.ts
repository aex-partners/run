import { Result, ok, fail } from '@/shared/kernel/Result'
import { PostSystemMessage, PostSystemMessageCommand } from '@/contexts/conversations/application/ports/in/PostSystemMessage'
import { AppendMessage } from '@/contexts/conversations/application/ports/in/AppendMessage'

// Thin adapter over AppendMessage for programmatic posts (no membership guard, no
// attachments). This is the seam reminders' ConversationPoster and the assistant
// bridge to. Defaults to the `system` role.
export class PostSystemMessageService implements PostSystemMessage {
  constructor(private readonly append: AppendMessage) {}

  async execute(cmd: PostSystemMessageCommand): Promise<Result<{ id: string }>> {
    const result = await this.append.execute({
      conversationId: cmd.conversationId,
      authorId: cmd.authorId ?? null,
      agentId: cmd.agentId ?? null,
      content: cmd.content,
      role: cmd.role ?? 'system',
      requireMembership: false,
    })
    if (!result.ok) return fail(result.error)
    return ok({ id: result.value.id })
  }
}
