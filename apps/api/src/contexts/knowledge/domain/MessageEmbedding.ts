import { AggregateRoot } from '@/shared/kernel/AggregateRoot'
import { Result, ok, fail } from '@/shared/kernel/Result'
import { MessageEmbeddingId } from '@/contexts/knowledge/domain/MessageEmbeddingId'
import { Embedding } from '@/contexts/knowledge/domain/Embedding'

export interface MessageEmbeddingProps {
  messageId: string
  conversationId: string
  content: string
  role: string
  embedding: Embedding
}

// AGGREGATE for conversation-level RAG: the vector of a single chat message,
// scoped to its conversation. Distinct from Knowledge (which is curated, scoped
// memory). No procedure mutates it via the six knowledge use-cases; it is
// written by the indexing path and read by semantic recall over a conversation.
export class MessageEmbedding extends AggregateRoot<MessageEmbeddingId> {
  private constructor(
    id: MessageEmbeddingId,
    private readonly _messageId: string,
    private readonly _conversationId: string,
    private readonly _content: string,
    private readonly _role: string,
    private readonly _embedding: Embedding,
    private readonly _createdAt: Date,
  ) {
    super(id)
  }

  static create(id: MessageEmbeddingId, props: MessageEmbeddingProps, now: Date): Result<MessageEmbedding> {
    if (props.content.trim().length < 1) return fail('MessageEmbedding: content is required')
    if (props.messageId.length < 1) return fail('MessageEmbedding: messageId is required')
    if (props.conversationId.length < 1) return fail('MessageEmbedding: conversationId is required')
    return ok(
      new MessageEmbedding(
        id,
        props.messageId,
        props.conversationId,
        props.content,
        props.role,
        props.embedding,
        now,
      ),
    )
  }

  static rehydrate(
    id: MessageEmbeddingId,
    props: MessageEmbeddingProps & { createdAt: Date },
  ): MessageEmbedding {
    return new MessageEmbedding(
      id,
      props.messageId,
      props.conversationId,
      props.content,
      props.role,
      props.embedding,
      props.createdAt,
    )
  }

  get messageId(): string {
    return this._messageId
  }

  get conversationId(): string {
    return this._conversationId
  }

  get content(): string {
    return this._content
  }

  get role(): string {
    return this._role
  }

  get embedding(): Embedding {
    return this._embedding
  }

  get createdAt(): Date {
    return this._createdAt
  }
}
