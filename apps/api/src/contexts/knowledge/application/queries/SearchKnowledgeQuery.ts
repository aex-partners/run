import { SearchKnowledge, SearchKnowledgeInput } from '@/contexts/knowledge/application/ports/in/SearchKnowledge'
import { KnowledgeSearchResult } from '@/contexts/knowledge/application/queries/KnowledgeView'
import { KnowledgeRepository } from '@/contexts/knowledge/application/ports/out/KnowledgeRepository'
import { EmbeddingGateway } from '@/contexts/knowledge/application/ports/out/EmbeddingGateway'
import { VectorStore } from '@/contexts/knowledge/application/ports/out/VectorStore'

const SEMANTIC_LIMIT = 10
const TEXT_FALLBACK_LIMIT = 10

// Read service. Embed the query and rank by pgvector cosine distance; if no
// embedding can be produced, fall back to a text search (which, as in AEX,
// excludes file-content rows and reports null similarity).
export class SearchKnowledgeQuery implements SearchKnowledge {
  constructor(
    private readonly repo: KnowledgeRepository,
    private readonly embeddings: EmbeddingGateway,
    private readonly vectors: VectorStore,
  ) {}

  async execute(input: SearchKnowledgeInput): Promise<KnowledgeSearchResult[]> {
    const embedding = await this.embeddings.embedQuery(input.query)

    if (!embedding) {
      const rows = await this.repo.textSearch({
        requesterId: input.requestedBy,
        query: input.query,
        excludeFileContent: true,
        limit: TEXT_FALLBACK_LIMIT,
      })
      return rows.map((r) => ({
        id: r.id,
        scope: r.scope,
        category: r.category,
        title: r.title,
        content: r.content,
        createdAt: r.createdAt,
        similarity: null,
      }))
    }

    return this.vectors.search({
      embedding,
      requesterId: input.requestedBy,
      excludeFileContent: false,
      limit: SEMANTIC_LIMIT,
    })
  }
}
