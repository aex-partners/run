import { Json } from '@/shared/domain/Json'
import { MessageRole } from '@/contexts/conversations/domain/MessageRole'
import { Reaction } from '@/contexts/conversations/domain/Reaction'

// A message as the chat screen consumes it: the row plus the resolved author
// name (user name -> agent name -> default). Mirrors the source `messages.list`
// projection. `metadata` is the raw JSON blob (replyTo/attachments/forwardedFrom/
// quickReplies); reactions/deletedFor/waveform are parsed.
export interface MessageView {
  id: string
  conversationId: string
  authorId: string | null
  agentId: string | null
  authorName: string
  metadata: Json | null
  content: string
  role: MessageRole
  pinned: boolean
  starred: boolean
  reactions: Reaction[]
  deletedFor: string[]
  audioUrl: string | null
  audioDuration: string | null
  audioWaveform: number[] | null
  audioTranscription: string | null
  audioTranscriptionEdited: boolean
  createdAt: Date
}

export interface ListMessagesInput {
  conversationId: string
  userId: string
  cursor?: string
  limit: number
}

export interface ListMessagesResult {
  items: MessageView[]
  nextCursor?: string
}

// Read side (CQRS). Paginated, newest-first, soft-deleted excluded, and messages
// the caller deleted-for-me filtered out. Membership is enforced by the use case
// before the read (the source guards then queries).
export interface ListMessages {
  execute(input: ListMessagesInput): Promise<ListMessagesResult>
}
