import { KnowledgeId } from '@/contexts/knowledge/domain/KnowledgeId'
import { KnowledgeSearchResult } from '@/contexts/knowledge/application/queries/KnowledgeView'

// Driven port over the pgvector projection of the `knowledge` table. The
// embedding column is maintained out-of-band (best-effort) and queried by cosine
// distance. Visibility for `requesterId` is applied inside the query.
export interface VectorSearchParams {
  embedding: number[]
  requesterId: string
  category?: string
  excludeFileContent: boolean
  limit: number
}

export interface VectorStore {
  saveEmbedding(id: KnowledgeId, embedding: number[]): Promise<void>
  search(params: VectorSearchParams): Promise<KnowledgeSearchResult[]>
}
