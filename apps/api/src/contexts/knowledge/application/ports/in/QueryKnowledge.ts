import { KnowledgeEntry } from '@/contexts/knowledge/application/queries/KnowledgeView'

// Driving read port for the AI (RAG). With a query it runs semantic search
// (falling back to text); without one it lists. Includes file-content rows so
// the agent can recall indexed file knowledge.
export interface QueryKnowledgeInput {
  requestedBy: string
  query?: string
  category?: string
}

export interface QueryKnowledge {
  execute(input: QueryKnowledgeInput): Promise<KnowledgeEntry[]>
}
