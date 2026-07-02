import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { CreateKnowledge, CreateKnowledgeCommand } from '@/contexts/knowledge/application/ports/in/CreateKnowledge'
import { KnowledgeRepository } from '@/contexts/knowledge/application/ports/out/KnowledgeRepository'
import { EmbeddingGateway } from '@/contexts/knowledge/application/ports/out/EmbeddingGateway'
import { VectorStore } from '@/contexts/knowledge/application/ports/out/VectorStore'
import { Knowledge } from '@/contexts/knowledge/domain/Knowledge'

// Application service. No business rule (those live in the aggregate): build,
// persist, publish, then index the embedding best-effort — a failed embedding
// must not fail the write, exactly as in AEX.
export class CreateKnowledgeService implements CreateKnowledge {
  constructor(
    private readonly repo: KnowledgeRepository,
    private readonly embeddings: EmbeddingGateway,
    private readonly vectors: VectorStore,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: CreateKnowledgeCommand): Promise<Result<{ id: string }>> {
    const id = this.repo.nextId()
    const knowledge = Knowledge.create(
      id,
      {
        scope: cmd.scope,
        category: cmd.category,
        title: cmd.title,
        content: cmd.content,
        createdBy: cmd.createdBy,
        sourceFileId: cmd.sourceFileId ?? null,
      },
      this.clock.now(),
    )
    if (!knowledge.ok) return fail(knowledge.error)

    await this.repo.save(knowledge.value)
    await this.events.publish(knowledge.value.pullEvents())
    await this.indexEmbedding(knowledge.value)
    return ok({ id: id.value })
  }

  // Best-effort: generate the vector and store it; swallow failures.
  private async indexEmbedding(knowledge: Knowledge): Promise<void> {
    try {
      const vector = await this.embeddings.embedDocument(knowledge.embeddingText())
      if (vector) await this.vectors.saveEmbedding(knowledge.id, vector)
    } catch (err) {
      console.error('[knowledge] embedding generation failed for', knowledge.id.value, err)
    }
  }
}
