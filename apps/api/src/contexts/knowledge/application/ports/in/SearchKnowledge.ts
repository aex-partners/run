import { KnowledgeSearchResult } from '@/contexts/knowledge/application/queries/KnowledgeView'

// Driving read port. Semantic (pgvector cosine) search with a text-search
// fallback when no embedding can be produced.
export interface SearchKnowledgeInput {
  query: string
  requestedBy: string
}

export interface SearchKnowledge {
  execute(input: SearchKnowledgeInput): Promise<KnowledgeSearchResult[]>
}
