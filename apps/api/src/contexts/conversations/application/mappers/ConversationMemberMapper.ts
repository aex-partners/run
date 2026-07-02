import { ConversationMember } from '@/contexts/conversations/domain/ConversationMember'

// Mirrors the `conversation_members` table. The personal flags are stored as
// integer 0/1 (nullable, defaulting to 0); the mapper folds them to booleans.
export interface ConversationMemberRow {
  conversationId: string
  userId: string
  joinedAt: Date
  lastReadAt: Date
  pinned: number | null
  favorite: number | null
  muted: number | null
}

export const ConversationMemberMapper = {
  toValues(conversationId: string, member: ConversationMember): ConversationMemberRow {
    return {
      conversationId,
      userId: member.userId,
      joinedAt: member.joinedAt,
      lastReadAt: member.lastReadAt,
      pinned: member.pinned ? 1 : 0,
      favorite: member.favorite ? 1 : 0,
      muted: member.muted ? 1 : 0,
    }
  },

  toDomain(row: ConversationMemberRow): ConversationMember {
    return ConversationMember.rehydrate({
      userId: row.userId,
      joinedAt: row.joinedAt,
      lastReadAt: row.lastReadAt,
      pinned: row.pinned === 1,
      favorite: row.favorite === 1,
      muted: row.muted === 1,
    })
  },
}
