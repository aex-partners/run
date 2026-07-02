import { ConversationMember } from '@/contexts/conversations/domain/ConversationMember'
import { ConversationId } from '@/contexts/conversations/domain/ids'

// Driven port for the per-member rows (`conversation_members`). Membership guards
// and the personal flag/read-cursor toggles operate on a single row, so they use
// this thin repo rather than loading the whole Conversation aggregate.
export interface ConversationMemberRepository {
  findMember(conversationId: ConversationId, userId: string): Promise<ConversationMember | null>
  listMemberIds(conversationId: ConversationId): Promise<string[]>
  // Upsert one member row (used by create/ensure flows). On-conflict-do-nothing
  // so re-adding an existing member is safe (DM concurrency, addMember).
  add(conversationId: ConversationId, members: readonly ConversationMember[]): Promise<void>
  // Persist a single member's mutable state (flags / lastReadAt).
  save(conversationId: ConversationId, member: ConversationMember): Promise<void>
}
