import { Conversation } from '@/contexts/conversations/domain/Conversation'
import { ConversationId } from '@/contexts/conversations/domain/ids'

// Driven port. States WHAT the application needs of conversation persistence; an
// adapter under adapters/out implements HOW (Drizzle/Postgres, in-memory).
// Members are part of the aggregate but persisted via ConversationMemberRepository
// (the source keeps them in a separate `conversation_members` table); `findById`
// here loads the conversation row WITHOUT members — membership guards use the
// member repo's single-row lookup, which is what the source does.
export interface ConversationRepository {
  nextId(): ConversationId
  findById(id: ConversationId): Promise<Conversation | null>
  exists(id: ConversationId): Promise<boolean>
  save(conversation: Conversation): Promise<void>
  // Insert only if absent (on-conflict-do-nothing): the deterministic-DM safety net.
  saveIfAbsent(conversation: Conversation): Promise<void>
  // Hard delete (the source `delete` removes the row; FK cascade drops members
  // and messages).
  delete(id: ConversationId): Promise<void>
  // Dedup lookups used by the ensure flows.
  findDmBetween(userAId: string, userBId: string): Promise<ConversationId | null>
  findEricConversation(agentId: string, userId: string): Promise<ConversationId | null>
}
