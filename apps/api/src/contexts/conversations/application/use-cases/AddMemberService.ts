import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { AddMember, AddMemberCommand } from '@/contexts/conversations/application/ports/in/AddMember'
import { ConversationMemberRepository } from '@/contexts/conversations/application/ports/out/ConversationMemberRepository'
import { ConversationId } from '@/contexts/conversations/domain/ids'
import { ConversationMember } from '@/contexts/conversations/domain/ConversationMember'
import { AccessPolicy } from '@/contexts/conversations/domain/services/AccessPolicy'

// Adds a user to a conversation. The actor must already be a member. Idempotent
// (on-conflict-do-nothing at the repo).
export class AddMemberService implements AddMember {
  constructor(
    private readonly members: ConversationMemberRepository,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: AddMemberCommand): Promise<Result<{ success: true }>> {
    const convId = ConversationId.of(cmd.conversationId)
    const actor = await this.members.findMember(convId, cmd.actorId)
    const guard = AccessPolicy.requireMember(actor)
    if (!guard.ok) return fail(guard.error)

    const member = ConversationMember.create(cmd.userId, this.clock.now())
    await this.members.add(convId, [member])
    return ok({ success: true })
  }
}
