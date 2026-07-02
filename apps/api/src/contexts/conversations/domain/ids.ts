import { Identifier } from '@/shared/kernel/Identifier'

export class ConversationId extends Identifier {
  static of(value: string): ConversationId {
    return new ConversationId(value)
  }
}

export class MessageId extends Identifier {
  static of(value: string): MessageId {
    return new MessageId(value)
  }
}
