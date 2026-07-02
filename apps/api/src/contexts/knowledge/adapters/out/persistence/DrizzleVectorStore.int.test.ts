import { randomUUID } from 'node:crypto'
import { beforeAll, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { describeIntegration, getTestDb } from '@/test/integration'
import { Database } from '@/platform/db/client'
import * as schema from '@/platform/db/schema'
import { DrizzleVectorStore } from '@/contexts/knowledge/adapters/out/persistence/DrizzleVectorStore'
import { KnowledgeId } from '@/contexts/knowledge/domain/KnowledgeId'
import { Category } from '@/contexts/knowledge/domain/Category'

// 1024-dim one-hot vector (matches the knowledge.embedding column dimension).
function unit(dim: number): number[] {
  const v = new Array(1024).fill(0)
  v[dim] = 1
  return v
}

describeIntegration('DrizzleVectorStore (integration)', () => {
  let db: Database
  let store: DrizzleVectorStore
  beforeAll(() => {
    db = getTestDb()
    store = new DrizzleVectorStore(db)
  })

  async function seedUser(): Promise<string> {
    const id = `u-${randomUUID()}`
    await db.insert(schema.users).values({ id, name: 'T', email: `${id}@t.io`, emailVerified: false })
    return id
  }

  async function seedKnowledge(userId: string, category: string): Promise<string> {
    const id = `k-${randomUUID()}`
    await db.insert(schema.knowledge).values({
      id,
      scope: 'personal',
      category,
      title: 'T',
      content: 'C',
      createdBy: userId,
    })
    return id
  }

  it('saveEmbedding persists the vector on the row', async () => {
    const userId = await seedUser()
    const cat = `cat-${randomUUID()}`
    const id = await seedKnowledge(userId, cat)

    await store.saveEmbedding(KnowledgeId.of(id), unit(0))

    const [row] = await db.select({ embedding: schema.knowledge.embedding }).from(schema.knowledge).where(eq(schema.knowledge.id, id))
    expect(row!.embedding).not.toBeNull()
    expect(row!.embedding).toHaveLength(1024)
  })

  it('ranks the nearest embedding first by cosine similarity', async () => {
    const userId = await seedUser()
    const cat = `cat-${randomUUID()}`
    const near = await seedKnowledge(userId, cat)
    const far = await seedKnowledge(userId, cat)
    await store.saveEmbedding(KnowledgeId.of(near), unit(0))
    await store.saveEmbedding(KnowledgeId.of(far), unit(1))

    const results = await store.search({
      embedding: unit(0),
      requesterId: userId,
      category: cat,
      excludeFileContent: false,
      limit: 10,
    })

    expect(results.map((r) => r.id)).toEqual([near, far])
    expect(results[0]!.similarity).toBeGreaterThan(0.99)
    expect(results[0]!.similarity!).toBeGreaterThan(results[1]!.similarity!)
  })

  it('excludes rows without an embedding', async () => {
    const userId = await seedUser()
    const cat = `cat-${randomUUID()}`
    const withVec = await seedKnowledge(userId, cat)
    const withoutVec = await seedKnowledge(userId, cat)
    await store.saveEmbedding(KnowledgeId.of(withVec), unit(2))

    const results = await store.search({
      embedding: unit(2),
      requesterId: userId,
      category: cat,
      excludeFileContent: false,
      limit: 10,
    })

    const ids = results.map((r) => r.id)
    expect(ids).toContain(withVec)
    expect(ids).not.toContain(withoutVec)
  })

  it('excludes file-content rows when requested', async () => {
    const userId = await seedUser()
    const cat = `cat-${randomUUID()}`
    const normal = await seedKnowledge(userId, cat)
    // A file-content row visible to this requester, with an embedding.
    const fc = `k-${randomUUID()}`
    await db.insert(schema.knowledge).values({ id: fc, scope: 'personal', category: Category.FILE_CONTENT, title: 'F', content: 'C', createdBy: userId })
    await store.saveEmbedding(KnowledgeId.of(normal), unit(3))
    await store.saveEmbedding(KnowledgeId.of(fc), unit(3))

    const results = await store.search({
      embedding: unit(3),
      requesterId: userId,
      excludeFileContent: true,
      limit: 50,
    })

    const ids = results.map((r) => r.id)
    expect(ids).toContain(normal)
    expect(ids).not.toContain(fc)
  })
})
