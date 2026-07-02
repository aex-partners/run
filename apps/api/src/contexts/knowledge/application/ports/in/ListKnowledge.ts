import { KnowledgeView } from '@/contexts/knowledge/application/queries/KnowledgeView'

// Driving read port. Honors scope visibility for `requestedBy` and hides
// file-content rows; ordered by most-recently-updated.
export interface ListKnowledgeInput {
  requestedBy: string
  scope?: string
  category?: string
  limit?: number
  offset?: number
}

export interface ListKnowledge {
  execute(input: ListKnowledgeInput): Promise<KnowledgeView[]>
}
