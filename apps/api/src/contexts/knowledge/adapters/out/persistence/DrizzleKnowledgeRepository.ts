import { randomUUID } from 'node:crypto'
import { and, desc, eq, ilike, ne, or } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { knowledge } from '@/platform/db/schema'
import {
  KnowledgeRepository,
  KnowledgeListFilter,
  KnowledgeTextSearchFilter,
} from '@/contexts/knowledge/application/ports/out/KnowledgeRepository'
import { KnowledgeView } from '@/contexts/knowledge/application/queries/KnowledgeView'
import { Knowledge } from '@/contexts/knowledge/domain/Knowledge'
import { KnowledgeId } from '@/contexts/knowledge/domain/KnowledgeId'
import { Category } from '@/contexts/knowledge/domain/Category'
import { KnowledgeMapper } from '@/contexts/knowledge/application/mappers/KnowledgeMapper'

// Driven adapter over the `knowledge` table. The write side maps to/from the
// aggregate; the read side projects columns straight into KnowledgeView. The
// embedding column is left untouched here (the VectorStore owns it).
const VIEW_COLUMNS = {
  id: knowledge.id,
  scope: knowledge.scope,
  category: knowledge.category,
  title: knowledge.title,
  content: knowledge.content,
  createdBy: knowledge.createdBy,
  createdAt: knowledge.createdAt,
  updatedAt: knowledge.updatedAt,
  sourceFileId: knowledge.sourceFileId,
}

export class DrizzleKnowledgeRepository implements KnowledgeRepository {
  constructor(private readonly db: Database) {}

  nextId(): KnowledgeId {
    return KnowledgeId.of(randomUUID())
  }

  async findById(id: KnowledgeId): Promise<Knowledge | null> {
    const [row] = await this.db
      .select({
        id: knowledge.id,
        scope: knowledge.scope,
        category: knowledge.category,
        title: knowledge.title,
        content: knowledge.content,
        createdBy: knowledge.createdBy,
        sourceFileId: knowledge.sourceFileId,
        createdAt: knowledge.createdAt,
        updatedAt: knowledge.updatedAt,
      })
      .from(knowledge)
      .where(eq(knowledge.id, id.value))
      .limit(1)
    return row ? KnowledgeMapper.toDomain(row) : null
  }

  async findBySourceFileId(fileId: string): Promise<Knowledge | null> {
    const [row] = await this.db
      .select({
        id: knowledge.id,
        scope: knowledge.scope,
        category: knowledge.category,
        title: knowledge.title,
        content: knowledge.content,
        createdBy: knowledge.createdBy,
        sourceFileId: knowledge.sourceFileId,
        createdAt: knowledge.createdAt,
        updatedAt: knowledge.updatedAt,
      })
      .from(knowledge)
      .where(eq(knowledge.sourceFileId, fileId))
      .orderBy(desc(knowledge.createdAt))
      .limit(1)
    return row ? KnowledgeMapper.toDomain(row) : null
  }

  async save(entry: Knowledge): Promise<void> {
    const row = KnowledgeMapper.toPersistence(entry)
    await this.db
      .insert(knowledge)
      .values({
        id: row.id,
        scope: row.scope,
        category: row.category,
        title: row.title,
        content: row.content,
        createdBy: row.createdBy,
        sourceFileId: row.sourceFileId,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })
      .onConflictDoUpdate({
        target: knowledge.id,
        set: {
          scope: row.scope,
          category: row.category,
          title: row.title,
          content: row.content,
          sourceFileId: row.sourceFileId,
          updatedAt: row.updatedAt,
        },
      })
  }

  async delete(id: KnowledgeId): Promise<void> {
    await this.db.delete(knowledge).where(eq(knowledge.id, id.value))
  }

  async list(filter: KnowledgeListFilter): Promise<KnowledgeView[]> {
    const conditions = [this.visibility(filter.requesterId)]
    if (filter.excludeFileContent) conditions.push(ne(knowledge.category, Category.FILE_CONTENT))
    if (filter.scope) conditions.push(eq(knowledge.scope, filter.scope))
    if (filter.category) conditions.push(eq(knowledge.category, filter.category))

    const rows = await this.db
      .select(VIEW_COLUMNS)
      .from(knowledge)
      .where(and(...conditions))
      .orderBy(desc(knowledge.updatedAt))
      .limit(filter.limit)
      .offset(filter.offset)
    return rows.map(toView)
  }

  async view(id: KnowledgeId, requesterId: string): Promise<KnowledgeView | null> {
    const [row] = await this.db
      .select(VIEW_COLUMNS)
      .from(knowledge)
      .where(eq(knowledge.id, id.value))
      .limit(1)
    if (!row) return null
    // ACL: personal entries are only visible to their creator.
    if (row.scope === 'personal' && row.createdBy !== requesterId) return null
    return toView(row)
  }

  async textSearch(filter: KnowledgeTextSearchFilter): Promise<KnowledgeView[]> {
    const term = `%${filter.query}%`
    const conditions = [
      this.visibility(filter.requesterId),
      or(ilike(knowledge.title, term), ilike(knowledge.content, term)),
    ]
    if (filter.excludeFileContent) conditions.push(ne(knowledge.category, Category.FILE_CONTENT))
    if (filter.category) conditions.push(eq(knowledge.category, filter.category))

    const rows = await this.db
      .select(VIEW_COLUMNS)
      .from(knowledge)
      .where(and(...conditions))
      .orderBy(desc(knowledge.updatedAt))
      .limit(filter.limit)
    return rows.map(toView)
  }

  async listCategories(): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({ category: knowledge.category })
      .from(knowledge)
      .where(ne(knowledge.category, Category.FILE_CONTENT))
    return rows.map((r) => r.category)
  }

  // Scope visibility: company entries are everyone's; personal entries only the
  // requester's.
  private visibility(requesterId: string) {
    return or(
      eq(knowledge.scope, 'company'),
      and(eq(knowledge.scope, 'personal'), eq(knowledge.createdBy, requesterId)),
    )
  }
}

function toView(row: {
  id: string
  scope: string
  category: string
  title: string
  content: string
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
  sourceFileId: string | null
}): KnowledgeView {
  return {
    id: row.id,
    scope: row.scope,
    category: row.category,
    title: row.title,
    content: row.content,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    sourceFileId: row.sourceFileId,
  }
}
