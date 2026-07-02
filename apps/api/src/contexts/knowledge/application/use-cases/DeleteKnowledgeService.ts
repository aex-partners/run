import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { DeleteKnowledge, DeleteKnowledgeCommand } from '@/contexts/knowledge/application/ports/in/DeleteKnowledge'
import { KnowledgeRepository } from '@/contexts/knowledge/application/ports/out/KnowledgeRepository'
import { KnowledgeId } from '@/contexts/knowledge/domain/KnowledgeId'

export class DeleteKnowledgeService implements DeleteKnowledge {
  constructor(
    private readonly repo: KnowledgeRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: DeleteKnowledgeCommand): Promise<Result<{ success: true }>> {
    const knowledge = await this.repo.findById(KnowledgeId.of(cmd.id))
    if (!knowledge) return fail('DeleteKnowledge: entry not found')

    // Authority: a personal entry may be deleted only by its creator; company
    // entries may be deleted by anyone.
    if (!knowledge.canBeDeletedBy(cmd.requestedBy)) {
      return fail("DeleteKnowledge: cannot delete another user's personal knowledge")
    }

    knowledge.markDeleted(this.clock.now())
    await this.repo.delete(knowledge.id)
    await this.events.publish(knowledge.pullEvents())
    return ok({ success: true })
  }
}
