import { randomUUID } from 'node:crypto'
import { beforeAll, expect, it } from 'vitest'
import { describeIntegration, getTestDb } from '@/test/integration'
import { Database } from '@/platform/db/client'
import * as schema from '@/platform/db/schema'
import { DrizzleMessageEmbeddingStore } from '@/contexts/knowledge/adapters/out/persistence/DrizzleMessageEmbeddingStore'
import { MessageEmbedding } from '@/contexts/knowledge/domain/MessageEmbedding'
import { MessageEmbeddingId } from '@/contexts/knowledge/domain/MessageEmbeddingId'
import { Embedding } from '@/contexts/knowledge/domain/Embedding'

const NOW = new Date('2024-01-01T00:00:00.000Z')

// 1536-dim one-hot vector (matches the message_embeddings.embedding dimension).
function unit(dim: number): number[] {
  const v = new Array(1536).fill(0)
  v[dim] = 1
  return v
}

describeIntegration('DrizzleMessageEmbeddingStore (integration)', () => {
  let db: Database
  let store: DrizzleMessageEmbeddingStore
  beforeAll(() => {
    db = getTestDb()
    store = new DrizzleMessageEmbeddingStore(db)
  })

  async function seedConversation(): Promise<string> {
    const id = `c-${randomUUID()}`
    await db.insert(schema.conversations).values({ id, type: 'ai' })
    return id
  }

  async function seedMessage(conversationId: string): Promise<string> {
    const id = `m-${randomUUID()}`
    await db.insert(schema.messages).values({ id, conversationId, content: 'hi', role: 'user' })
    return id
  }

  async function saveEmbedding(conversationId: string, vector: number[]): Promise<string> {
    const messageId = await seedMessage(conversationId)
    const id = `me-${randomUUID()}`
    const emb = Embedding.of(vector)
    if (!emb.ok) throw new Error('embedding setup failed')
    const me = MessageEmbedding.create(
      MessageEmbeddingId.of(id),
      { messageId, conversationId, content: 'hello there', role: 'user', embedding: emb.value },
      NOW,
    )
    if (!me.ok) throw new Error('message embedding setup failed')
    await store.save(me.value)
    return id
  }

  it('persists and recalls a message embedding within its conversation', async () => {
    const conversationId = await seedConversation()
    const id = await saveEmbedding(conversationId, unit(0))

    const matches = await store.searchByConversation({ conversationId, embedding: unit(0), limit: 10 })
    expect(matches.map((m) => m.id)).toEqual([id])
    expect(matches[0]!.content).toBe('hello there')
    expect(matches[0]!.role).toBe('user')
    expect(matches[0]!.similarity).toBeGreaterThan(0.99)
  })

  it('ranks the nearest embedding first', async () => {
    const conversationId = await seedConversation()
    const near = await saveEmbedding(conversationId, unit(0))
    const far = await saveEmbedding(conversationId, unit(1))

    const matches = await store.searchByConversation({ conversationId, embedding: unit(0), limit: 10 })
    expect(matches.map((m) => m.id)).toEqual([near, far])
    expect(matches[0]!.similarity!).toBeGreaterThan(matches[1]!.similarity!)
  })

  it('scopes recall to the given conversation', async () => {
    const convA = await seedConversation()
    const convB = await seedConversation()
    const inA = await saveEmbedding(convA, unit(2))
    const inB = await saveEmbedding(convB, unit(2))

    const matches = await store.searchByConversation({ conversationId: convA, embedding: unit(2), limit: 10 })
    const ids = matches.map((m) => m.id)
    expect(ids).toContain(inA)
    expect(ids).not.toContain(inB)
  })

  it('mints unique ids via nextId', () => {
    expect(store.nextId().value).not.toBe(store.nextId().value)
  })
})
