import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { EventPublisher } from '@/shared/kernel/EventPublisher'
import { IndexFile, IndexFileCommand } from '@/contexts/knowledge/application/ports/in/IndexFile'
import { KnowledgeRepository } from '@/contexts/knowledge/application/ports/out/KnowledgeRepository'
import { EmbeddingGateway } from '@/contexts/knowledge/application/ports/out/EmbeddingGateway'
import { VectorStore } from '@/contexts/knowledge/application/ports/out/VectorStore'
import { Knowledge } from '@/contexts/knowledge/domain/Knowledge'
import { Category } from '@/contexts/knowledge/domain/Category'

// Application service that turns an AI-indexed file into persistent knowledge.
// The files context enqueues a `file-indexing` job; main's consumer extracts the
// text and drives this in-port. One knowledge row per file: scope "company",
// category "file-content", title = fileName, content = text, sourceFileId =
// fileId. The embedding is indexed best-effort — a failed embedding must NOT
// fail the write, exactly as in AEX's file-indexing-worker.
//
// Idempotent on (sourceFileId): re-indexing the same file UPDATES the prior
// file-content row in place (same id, re-embedded) instead of creating a
// duplicate, so an at-least-once queue can replay the job safely.
export class IndexFileService implements IndexFile {
  constructor(
    private readonly repo: KnowledgeRepository,
    private readonly embeddings: EmbeddingGateway,
    private readonly vectors: VectorStore,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: IndexFileCommand): Promise<Result<{ knowledgeId: string }>> {
    const now = this.clock.now()
    const existing = await this.repo.findBySourceFileId(cmd.fileId)

    // Re-index: replace the prior file-content row in place. Keeps the id (and
    // its vector association) stable and re-embeds only when the text changed.
    if (existing) {
      const updated = existing.update({ title: cmd.fileName, content: cmd.text }, now)
      if (!updated.ok) return fail(updated.error)

      await this.repo.save(existing)
      await this.events.publish(existing.pullEvents())
      if (updated.value.contentChanged) await this.indexEmbedding(existing)
      return ok({ knowledgeId: existing.id.value })
    }

    // First index: create a fresh company-scoped file-content row.
    const id = this.repo.nextId()
    const created = Knowledge.create(
      id,
      {
        scope: 'company',
        category: Category.FILE_CONTENT,
        title: cmd.fileName,
        content: cmd.text,
        createdBy: null,
        sourceFileId: cmd.fileId,
      },
      now,
    )
    if (!created.ok) return fail(created.error)

    await this.repo.save(created.value)
    await this.events.publish(created.value.pullEvents())
    await this.indexEmbedding(created.value)
    return ok({ knowledgeId: id.value })
  }

  // Best-effort: generate the vector and store it; swallow failures so a flaky
  // embedding model never fails the knowledge write (mirrors CreateKnowledge).
  private async indexEmbedding(knowledge: Knowledge): Promise<void> {
    try {
      const vector = await this.embeddings.embedDocument(knowledge.embeddingText())
      if (vector) await this.vectors.saveEmbedding(knowledge.id, vector)
    } catch (err) {
      console.error('[knowledge] file embedding failed for', knowledge.id.value, err)
    }
  }
}
