import { Result } from '@/shared/kernel/Result'
import { MessageRole } from '@/contexts/conversations/domain/MessageRole'
import { ReplyTo, Attachment, ForwardedFrom } from '@/contexts/conversations/domain/MessageMetadata'

// Generic driving port: post a message into a conversation. Backs the `send` and
// `sendAudio` procedures AND is the seam OTHER contexts post through (reminders
// firing, the assistant posting AI turns) — those set `requireMembership: false`
// and a non-user role. The user `send` path sets `requireMembership: true` so the
// membership guard runs and attachments are shared to members via the file ACL.
export interface AppendAudio {
  url: string
  duration: string
  waveform?: number[]
  transcription?: string
}

export interface AppendMessageCommand {
  conversationId: string
  authorId: string | null
  agentId?: string | null
  content: string
  role: MessageRole
  authorName?: string | null
  replyTo?: ReplyTo
  attachments?: Attachment[]
  forwardedFrom?: ForwardedFrom
  audio?: AppendAudio
  requireMembership: boolean
}

export interface AppendMessageResult {
  id: string
  conversationId: string
  authorId: string | null
  authorName: string | null
  content: string
  role: MessageRole
  createdAt: Date
}

export interface AppendMessage {
  execute(cmd: AppendMessageCommand): Promise<Result<AppendMessageResult>>
}
