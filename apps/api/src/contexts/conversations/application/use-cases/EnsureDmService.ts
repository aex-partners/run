import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { EnsureDm, EnsureDmCommand } from '@/contexts/conversations/application/ports/in/EnsureDm'
import { ConversationRepository } from '@/contexts/conversations/application/ports/out/ConversationRepository'
import { ConversationMemberRepository } from '@/contexts/conversations/application/ports/out/ConversationMemberRepository'
import { Conversation } from '@/contexts/conversations/domain/Conversation'
import { DmConversationPolicy } from '@/contexts/conversations/domain/services/DmConversationPolicy'

// Application service for the DM-dedup rule. First tries the membership lookup
// (the primary dedup); if absent, mints the deterministic pair id and inserts
// idempotently (saveIfAbsent + member add are on-conflict-do-nothing), so two
// concurrent ensures converge on the same conversation.
export class EnsureDmService implements EnsureDm {
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly members: ConversationMemberRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: EnsureDmCommand): Promise<Result<{ id: string }>> {
    const distinct = DmConversationPolicy.ensureDistinct(cmd.userId, cmd.peerUserId)
    if (!distinct.ok) return fail(distinct.error)

    const existing = await this.conversations.findDmBetween(cmd.userId, cmd.peerUserId)
    if (existing) return ok({ id: existing.value })

    const idResult = DmConversationPolicy.deterministicId(cmd.userId, cmd.peerUserId)
    if (!idResult.ok) return fail(idResult.error)
    const id = idResult.value

    const conversation = Conversation.createDm({
      id,
      userA: cmd.userId,
      userB: cmd.peerUserId,
      now: this.clock.now(),
    })

    await this.conversations.saveIfAbsent(conversation)
    await this.members.add(id, conversation.members())
    await this.events.publish(conversation.pullEvents())

    return ok({ id: id.value })
  }
}
