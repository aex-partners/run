import { Conversation } from '@/contexts/conversations/domain/Conversation'
import { ConversationId } from '@/contexts/conversations/domain/ids'
import { ConversationType, isConversationType } from '@/contexts/conversations/domain/ConversationType'
import { ConversationMember } from '@/contexts/conversations/domain/ConversationMember'
import { ConversationView } from '@/contexts/conversations/application/queries/GetConversation'

// Mirrors the `conversations` table. The mapper is the only place that knows the
// on-disk shape.
export interface ConversationRow {
  id: string
  name: string | null
  type: ConversationType
  agentId: string | null
  sessionId: string | null
  createdAt: Date
  updatedAt: Date
}

const asType = (raw: string): ConversationType => (isConversationType(raw) ? raw : 'ai')

export const ConversationMapper = {
  toPersistence(conversation: Conversation): ConversationRow {
    return {
      id: conversation.id.value,
      name: conversation.name,
      type: conversation.type,
      agentId: conversation.agentId,
      sessionId: conversation.sessionId,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    }
  },

  // Shape the aggregate into the scalar view the create/rename/setAgent mutations
  // echo back to the client.
  toView(conversation: Conversation): ConversationView {
    return {
      id: conversation.id.value,
      name: conversation.name,
      type: conversation.type,
      agentId: conversation.agentId,
      sessionId: conversation.sessionId,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    }
  },

  // Rehydrate. `members` is supplied when the caller loaded them; the membership
  // guards use the member repo's single-row lookup, so most write paths pass [].
  toDomain(row: ConversationRow, members: ConversationMember[] = []): Conversation {
    return Conversation.rehydrate({
      id: ConversationId.of(row.id),
      name: row.name,
      type: asType(row.type),
      agentId: row.agentId,
      sessionId: row.sessionId,
      members,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })
  },
}
