import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { messageEmbeddings } from '@/platform/db/schema'
import {
  MessageEmbeddingStore,
  MessageEmbeddingSearchParams,
  MessageEmbeddingMatch,
} from '@/contexts/knowledge/application/ports/out/MessageEmbeddingStore'
import { MessageEmbedding } from '@/contexts/knowledge/domain/MessageEmbedding'
import { MessageEmbeddingId } from '@/contexts/knowledge/domain/MessageEmbeddingId'
import { MessageEmbeddingMapper } from '@/contexts/knowledge/application/mappers/MessageEmbeddingMapper'

// Driven adapter over the `message_embeddings` table (conversation RAG). Insert
// uses Drizzle's typed vector column; cosine recall uses raw SQL.
export class DrizzleMessageEmbeddingStore implements MessageEmbeddingStore {
  constructor(private readonly db: Database) {}

  nextId(): MessageEmbeddingId {
    return MessageEmbeddingId.of(randomUUID())
  }

  async save(embedding: MessageEmbedding): Promise<void> {
    const row = MessageEmbeddingMapper.toPersistence(embedding)
    await this.db.insert(messageEmbeddings).values({
      id: row.id,
      messageId: row.messageId,
      conversationId: row.conversationId,
      content: row.content,
      role: row.role,
      embedding: row.embedding,
      createdAt: row.createdAt,
    })
  }

  async searchByConversation(params: MessageEmbeddingSearchParams): Promise<MessageEmbeddingMatch[]> {
    const vectorLiteral = sql`'[${sql.raw(params.embedding.join(','))}]'::vector`
    const result = await this.db.execute(sql`
      SELECT id, message_id, conversation_id, content, role,
             1 - (embedding <=> ${vectorLiteral}) as similarity
      FROM message_embeddings
      WHERE conversation_id = ${params.conversationId}
      ORDER BY embedding <=> ${vectorLiteral} ASC
      LIMIT ${params.limit}
    `)

    return rowsOf(result).map((r) => ({
      id: String(r.id),
      messageId: String(r.message_id),
      conversationId: String(r.conversation_id),
      content: String(r.content),
      role: String(r.role),
      similarity: r.similarity != null ? Number(r.similarity) : null,
    }))
  }
}

function rowsOf(result: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(result)) return result as Array<Record<string, unknown>>
  const maybe = (result as { rows?: unknown }).rows
  return Array.isArray(maybe) ? (maybe as Array<Record<string, unknown>>) : []
}
