import { AggregateRoot } from '@/shared/kernel/AggregateRoot'
import { ConversationId } from '@/contexts/assistant/domain/ids'
import { Message, Role } from '@/contexts/assistant/domain/Message'

// Aggregate. Owns the ordered message history and the invariant that a
// conversation always starts from a user turn.
export class Conversation extends AggregateRoot<ConversationId> {
  private constructor(
    id: ConversationId,
    private _messages: Message[],
  ) {
    super(id)
  }

  static start(id: ConversationId): Conversation {
    return new Conversation(id, [])
  }

  static rehydrate(id: ConversationId, messages: Message[]): Conversation {
    return new Conversation(id, messages)
  }

  append(role: Role, content: string): void {
    this._messages.push(new Message(role, content))
  }

  messages(): readonly Message[] {
    return this._messages
  }
}
