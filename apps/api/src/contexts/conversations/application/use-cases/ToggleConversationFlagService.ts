import { Result, ok, fail } from '@/shared/kernel/Result'
import {
  ToggleConversationFlag,
  ToggleConversationFlagCommand,
  ConversationFlag,
} from '@/contexts/conversations/application/ports/in/ToggleConversationFlag'
import { ConversationMemberRepository } from '@/contexts/conversations/application/ports/out/ConversationMemberRepository'
import { ConversationMember } from '@/contexts/conversations/domain/ConversationMember'
import { ConversationId } from '@/contexts/conversations/domain/ids'

// Backs pin / favorite / mute. Each is a personal per-member toggle; a missing
// membership row fails (the source returns NOT_FOUND).
export class ToggleConversationFlagService implements ToggleConversationFlag {
  constructor(private readonly members: ConversationMemberRepository) {}

  async execute(cmd: ToggleConversationFlagCommand): Promise<Result<{ flag: ConversationFlag; value: boolean }>> {
    const convId = ConversationId.of(cmd.id)
    const member = await this.members.findMember(convId, cmd.userId)
    if (!member) return fail('Conversation membership not found')

    const value = this.apply(member, cmd.flag)
    await this.members.save(convId, member)
    return ok({ flag: cmd.flag, value })
  }

  private apply(member: ConversationMember, flag: ConversationFlag): boolean {
    switch (flag) {
      case 'pinned':
        return member.togglePinned()
      case 'favorite':
        return member.toggleFavorite()
      case 'muted':
        return member.toggleMuted()
    }
  }
}
