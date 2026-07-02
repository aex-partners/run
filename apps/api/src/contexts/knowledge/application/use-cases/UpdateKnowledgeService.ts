import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { UpdateKnowledge, UpdateKnowledgeCommand } from '@/contexts/knowledge/application/ports/in/UpdateKnowledge'
import { KnowledgeRepository } from '@/contexts/knowledge/application/ports/out/KnowledgeRepository'
import { EmbeddingGateway } from '@/contexts/knowledge/application/ports/out/EmbeddingGateway'
import { VectorStore } from '@/contexts/knowledge/application/ports/out/VectorStore'
import { KnowledgeId } from '@/contexts/knowledge/domain/KnowledgeId'

export class UpdateKnowledgeService implements UpdateKnowledge {
  constructor(
    private readonly repo: KnowledgeRepository,
    private readonly embeddings: EmbeddingGateway,
    private readonly vectors: VectorStore,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: UpdateKnowledgeCommand): Promise<Result<{ success: true }>> {
    const knowledge = await this.repo.findById(KnowledgeId.of(cmd.id))
    if (!knowledge) return fail('UpdateKnowledge: entry not found')

    // Authority: a personal entry may be edited only by its creator.
    if (!knowledge.canBeModifiedBy(cmd.requestedBy)) {
      return fail('UpdateKnowledge: forbidden')
    }

    const updated = knowledge.update(
      { scope: cmd.scope, category: cmd.category, title: cmd.title, content: cmd.content },
      this.clock.now(),
    )
    if (!updated.ok) return fail(updated.error)

    await this.repo.save(knowledge)
    await this.events.publish(knowledge.pullEvents())

    // Regenerate the embedding only when the indexed text changed.
    if (updated.value.contentChanged) {
      try {
        const vector = await this.embeddings.embedDocument(knowledge.embeddingText())
        if (vector) await this.vectors.saveEmbedding(knowledge.id, vector)
      } catch (err) {
        console.error('[knowledge] embedding regeneration failed for', knowledge.id.value, err)
      }
    }

    return ok({ success: true })
  }
}
