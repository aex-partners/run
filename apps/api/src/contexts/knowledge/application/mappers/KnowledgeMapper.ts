import { Knowledge } from '@/contexts/knowledge/domain/Knowledge'
import { KnowledgeId } from '@/contexts/knowledge/domain/KnowledgeId'

// Persistence row for the `knowledge` table — minus the embedding column, which
// is a projection owned by the VectorStore. The mapper is the only place that
// knows the on-disk shape.
export interface KnowledgeRow {
  id: string
  scope: string
  category: string
  title: string
  content: string
  createdBy: string | null
  sourceFileId: string | null
  createdAt: Date
  updatedAt: Date
}

export const KnowledgeMapper = {
  toPersistence(knowledge: Knowledge): KnowledgeRow {
    return {
      id: knowledge.id.value,
      scope: knowledge.scope.kind,
      category: knowledge.category.value,
      title: knowledge.title,
      content: knowledge.content,
      createdBy: knowledge.createdBy,
      sourceFileId: knowledge.sourceFileId,
      createdAt: knowledge.createdAt,
      updatedAt: knowledge.updatedAt,
    }
  },

  toDomain(row: KnowledgeRow): Knowledge {
    return Knowledge.rehydrate(KnowledgeId.of(row.id), {
      scope: row.scope,
      category: row.category,
      title: row.title,
      content: row.content,
      createdBy: row.createdBy,
      sourceFileId: row.sourceFileId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })
  },
}
