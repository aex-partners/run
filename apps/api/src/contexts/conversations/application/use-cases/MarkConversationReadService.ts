import { Result, ok } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { MarkConversationRead, MarkConversationReadCommand } from '@/contexts/conversations/application/ports/in/MarkConversationRead'
import { ConversationMemberRepository } from '@/contexts/conversations/application/ports/out/ConversationMemberRepository'
import { ConversationId } from '@/contexts/conversations/domain/ids'

// Advances the caller's read cursor. The source updates the member row directly
// (no guard); a non-member is simply a no-op here.
export class MarkConversationReadService implements MarkConversationRead {
  constructor(
    private readonly members: ConversationMemberRepository,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: MarkConversationReadCommand): Promise<Result<{ success: true }>> {
    const convId = ConversationId.of(cmd.id)
    const member = await this.members.findMember(convId, cmd.userId)
    if (member) {
      member.markRead(this.clock.now())
      await this.members.save(convId, member)
    }
    return ok({ success: true })
  }
}
