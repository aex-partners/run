import { KnowledgeView } from '@/contexts/knowledge/application/queries/KnowledgeView'

// Read port (CQRS). Single-entry fetch with ACL: a personal entry is returned
// only to its creator, otherwise null. Lives next to its view, mirroring the
// data context's ListRecords query.
export interface GetKnowledgeInput {
  id: string
  requestedBy: string
}

export interface GetKnowledge {
  execute(input: GetKnowledgeInput): Promise<KnowledgeView | null>
}
