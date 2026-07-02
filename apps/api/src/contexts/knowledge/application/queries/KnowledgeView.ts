// Read-model DTOs (CQRS read side). These never carry domain objects — they are
// flat projections shaped for callers (the HTTP list/getById, semantic search,
// and the AI RAG query). Adapters fill them straight from a query.

export interface KnowledgeView {
  id: string
  scope: string
  category: string
  title: string
  content: string
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
  sourceFileId: string | null
}

// Result of a semantic (or fallback text) search. `similarity` is null when the
// match came from text search rather than the pgvector cosine ranking.
export interface KnowledgeSearchResult {
  id: string
  scope: string
  category: string
  title: string
  content: string
  createdAt: Date
  similarity: number | null
}

// Compact entry returned to the AI by the RAG query — only what it needs to cite.
export interface KnowledgeEntry {
  id: string
  scope: string
  category: string
  title: string
  content: string
}
