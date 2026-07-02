import { ConversationRepository } from '@/contexts/assistant/application/ports/out/ConversationRepository'
import { Conversation } from '@/contexts/assistant/domain/Conversation'
import { ConversationId } from '@/contexts/assistant/domain/ids'
import { Message } from '@/contexts/assistant/domain/Message'

export class InMemoryConversationRepository implements ConversationRepository {
  private readonly store = new Map<string, Message[]>()

  async findById(id: ConversationId): Promise<Conversation | null> {
    const messages = this.store.get(id.value)
    return messages ? Conversation.rehydrate(id, [...messages]) : null
  }

  async save(conversation: Conversation): Promise<void> {
    this.store.set(conversation.id.value, [...conversation.messages()])
  }
}
