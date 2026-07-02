import { QueryKnowledge, QueryKnowledgeInput } from '@/contexts/knowledge/application/ports/in/QueryKnowledge'
import { KnowledgeEntry } from '@/contexts/knowledge/application/queries/KnowledgeView'
import { KnowledgeRepository } from '@/contexts/knowledge/application/ports/out/KnowledgeRepository'
import { EmbeddingGateway } from '@/contexts/knowledge/application/ports/out/EmbeddingGateway'
import { VectorStore } from '@/contexts/knowledge/application/ports/out/VectorStore'

const SEMANTIC_LIMIT = 20
const LIST_LIMIT = 50

// Read service for the AI (RAG). With a query: semantic search, falling back to
// text. Without a query: list everything visible. Both include file-content rows
// so the agent can recall file-indexed knowledge, matching AEX's query_knowledge
// tool exactly.
export class QueryKnowledgeQuery implements QueryKnowledge {
  constructor(
    private readonly repo: KnowledgeRepository,
    private readonly embeddings: EmbeddingGateway,
    private readonly vectors: VectorStore,
  ) {}

  async execute(input: QueryKnowledgeInput): Promise<KnowledgeEntry[]> {
    if (input.query) {
      const embedding = await this.embeddings.embedQuery(input.query)
      if (embedding) {
        const results = await this.vectors.search({
          embedding,
          requesterId: input.requestedBy,
          category: input.category,
          excludeFileContent: false,
          limit: SEMANTIC_LIMIT,
        })
        return results.map(toEntry)
      }

      const rows = await this.repo.textSearch({
        requesterId: input.requestedBy,
        query: input.query,
        category: input.category,
        excludeFileContent: false,
        limit: LIST_LIMIT,
      })
      return rows.map(toEntry)
    }

    const rows = await this.repo.list({
      requesterId: input.requestedBy,
      category: input.category,
      excludeFileContent: false,
      limit: LIST_LIMIT,
      offset: 0,
    })
    return rows.map(toEntry)
  }
}

function toEntry(r: {
  id: string
  scope: string
  category: string
  title: string
  content: string
}): KnowledgeEntry {
  return { id: r.id, scope: r.scope, category: r.category, title: r.title, content: r.content }
}
