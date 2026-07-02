import { Conversation } from '@/contexts/assistant/domain/Conversation'
import { ConversationId } from '@/contexts/assistant/domain/ids'

export interface ConversationRepository {
  findById(id: ConversationId): Promise<Conversation | null>
  save(conversation: Conversation): Promise<void>
}
