import { MessageEmbedding } from '@/contexts/knowledge/domain/MessageEmbedding'
import { MessageEmbeddingId } from '@/contexts/knowledge/domain/MessageEmbeddingId'

// Driven port over the `message_embeddings` table: persist a message's vector
// and recall the most similar messages within a conversation (conversation RAG).
export interface MessageEmbeddingSearchParams {
  conversationId: string
  embedding: number[]
  limit: number
}

export interface MessageEmbeddingMatch {
  id: string
  messageId: string
  conversationId: string
  content: string
  role: string
  similarity: number | null
}

export interface MessageEmbeddingStore {
  nextId(): MessageEmbeddingId
  save(embedding: MessageEmbedding): Promise<void>
  searchByConversation(params: MessageEmbeddingSearchParams): Promise<MessageEmbeddingMatch[]>
}
