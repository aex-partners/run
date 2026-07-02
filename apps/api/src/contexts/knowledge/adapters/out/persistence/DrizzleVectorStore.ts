import { eq, sql } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { knowledge } from '@/platform/db/schema'
import {
  VectorStore,
  VectorSearchParams,
} from '@/contexts/knowledge/application/ports/out/VectorStore'
import { KnowledgeSearchResult } from '@/contexts/knowledge/application/queries/KnowledgeView'
import { KnowledgeId } from '@/contexts/knowledge/domain/KnowledgeId'
import { Category } from '@/contexts/knowledge/domain/Category'

// Driven adapter over the pgvector embedding column of the `knowledge` table.
// Cosine distance (`<=>`) requires raw SQL — Drizzle has no operator for it —
// so the search mirrors AEX's query 1:1, while the write uses Drizzle's typed
// vector update.
export class DrizzleVectorStore implements VectorStore {
  constructor(private readonly db: Database) {}

  async saveEmbedding(id: KnowledgeId, embedding: number[]): Promise<void> {
    await this.db.update(knowledge).set({ embedding }).where(eq(knowledge.id, id.value))
  }

  async search(params: VectorSearchParams): Promise<KnowledgeSearchResult[]> {
    const vectorLiteral = sql`'[${sql.raw(params.embedding.join(','))}]'::vector`
    const categoryFilter = params.category ? sql` AND category = ${params.category}` : sql``
    const fileContentFilter = params.excludeFileContent
      ? sql` AND category <> ${Category.FILE_CONTENT}`
      : sql``

    const result = await this.db.execute(sql`
      SELECT id, scope, category, title, content, created_at,
             1 - (embedding <=> ${vectorLiteral}) as similarity
      FROM knowledge
      WHERE (scope = 'company' OR (scope = 'personal' AND created_by = ${params.requesterId}))
        AND embedding IS NOT NULL
        ${categoryFilter}
        ${fileContentFilter}
      ORDER BY embedding <=> ${vectorLiteral} ASC
      LIMIT ${params.limit}
    `)

    return rowsOf(result).map((r) => ({
      id: String(r.id),
      scope: String(r.scope),
      category: String(r.category),
      title: String(r.title),
      content: String(r.content),
      createdAt: r.created_at as Date,
      similarity: r.similarity != null ? Number(r.similarity) : null,
    }))
  }
}

// drizzle/postgres-js returns the rows as an array-like RowList; node-postgres
// nests them under `.rows`. Handle both, as AEX does.
function rowsOf(result: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(result)) return result as Array<Record<string, unknown>>
  const maybe = (result as { rows?: unknown }).rows
  return Array.isArray(maybe) ? (maybe as Array<Record<string, unknown>>) : []
}
