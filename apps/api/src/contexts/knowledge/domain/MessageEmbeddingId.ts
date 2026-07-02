import { Identifier } from '@/shared/kernel/Identifier'

export class MessageEmbeddingId extends Identifier {
  static of(value: string): MessageEmbeddingId {
    return new MessageEmbeddingId(value)
  }
}
