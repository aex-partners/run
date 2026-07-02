import { MessageEmbedding } from '@/contexts/knowledge/domain/MessageEmbedding'
import { MessageEmbeddingId } from '@/contexts/knowledge/domain/MessageEmbeddingId'
import { Embedding } from '@/contexts/knowledge/domain/Embedding'

// Persistence row for the `message_embeddings` table. The embedding is stored as
// a pgvector column; here it is the plain number[] the driver round-trips.
export interface MessageEmbeddingRow {
  id: string
  messageId: string
  conversationId: string
  content: string
  role: string
  embedding: number[]
  createdAt: Date
}

export const MessageEmbeddingMapper = {
  toPersistence(embedding: MessageEmbedding): MessageEmbeddingRow {
    return {
      id: embedding.id.value,
      messageId: embedding.messageId,
      conversationId: embedding.conversationId,
      content: embedding.content,
      role: embedding.role,
      embedding: embedding.embedding.toArray(),
      createdAt: embedding.createdAt,
    }
  },

  toDomain(row: MessageEmbeddingRow): MessageEmbedding {
    const embedding = Embedding.of(row.embedding)
    if (!embedding.ok) throw new Error(`MessageEmbeddingMapper.toDomain: ${embedding.error}`)
    return MessageEmbedding.rehydrate(MessageEmbeddingId.of(row.id), {
      messageId: row.messageId,
      conversationId: row.conversationId,
      content: row.content,
      role: row.role,
      embedding: embedding.value,
      createdAt: row.createdAt,
    })
  },
}
