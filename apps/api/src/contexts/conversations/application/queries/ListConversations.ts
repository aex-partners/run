import { ConversationType } from '@/contexts/conversations/domain/ConversationType'

// One row of the conversation list: the conversation plus the caller's view of it
// (last message preview, unread count, personal flags, and for DMs the resolved
// peer display name). Mirrors the source `conversations.list` shape 1:1.
export interface ConversationListItem {
  id: string
  name: string
  type: ConversationType
  agentId: string | null
  createdAt: Date
  lastMessage: string
  lastMessageAt: string
  unreadCount: number
  pinned: boolean
  favorite: boolean
  muted: boolean
}

// Read side (CQRS). Answered by a direct multi-join query, scoped to the
// conversations the user is a member of.
export interface ListConversations {
  execute(input: { userId: string }): Promise<ConversationListItem[]>
}
