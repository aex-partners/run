import { Knowledge } from '@/contexts/knowledge/domain/Knowledge'
import { KnowledgeId } from '@/contexts/knowledge/domain/KnowledgeId'
import { KnowledgeView } from '@/contexts/knowledge/application/queries/KnowledgeView'

// Driven port. The write side loads/saves the aggregate; the read side answers
// flat projections directly (no aggregate round-trip). An adapter implements
// HOW (Drizzle over the `knowledge` table, in-memory, ...). Semantic similarity
// is NOT here — that is the VectorStore's job.

export interface KnowledgeListFilter {
  requesterId: string
  scope?: string
  category?: string
  excludeFileContent: boolean
  limit: number
  offset: number
}

export interface KnowledgeTextSearchFilter {
  requesterId: string
  query: string
  category?: string
  excludeFileContent: boolean
  limit: number
}

export interface KnowledgeRepository {
  nextId(): KnowledgeId
  findById(id: KnowledgeId): Promise<Knowledge | null>
  // Loads the file-content aggregate auto-indexed from a given source file, if
  // any. Backs idempotent re-indexing: IndexFile updates this row in place
  // instead of creating a duplicate. Returns null when the file was never
  // indexed.
  findBySourceFileId(fileId: string): Promise<Knowledge | null>
  save(knowledge: Knowledge): Promise<void>
  delete(id: KnowledgeId): Promise<void>

  // Read side (CQRS projections, scope-visibility applied for `requesterId`).
  list(filter: KnowledgeListFilter): Promise<KnowledgeView[]>
  view(id: KnowledgeId, requesterId: string): Promise<KnowledgeView | null>
  textSearch(filter: KnowledgeTextSearchFilter): Promise<KnowledgeView[]>
  listCategories(): Promise<string[]>
}
