import { Message } from '@/contexts/conversations/domain/Message'
import { MessageId } from '@/contexts/conversations/domain/ids'

// Driven port. The application states WHAT it needs of message persistence; an
// adapter implements HOW. `save` upserts (create + every transition lands here).
export interface MessageRepository {
  nextId(): MessageId
  findById(id: MessageId): Promise<Message | null>
  save(message: Message): Promise<void>
  saveMany(messages: readonly Message[]): Promise<void>
}
