import { AggregateRoot } from '@/shared/kernel/AggregateRoot'
import { Result, ok, fail } from '@/shared/kernel/Result'
import { JsonObject } from '@/shared/domain/Json'
import { MessageId } from '@/contexts/conversations/domain/ids'
import { MessageRole } from '@/contexts/conversations/domain/MessageRole'
import { Reaction, toggleReaction } from '@/contexts/conversations/domain/Reaction'
import { readAttachments, markQuickRepliesAnswered } from '@/contexts/conversations/domain/MessageMetadata'
import { MessagePosted } from '@/contexts/conversations/domain/events/MessagePosted'
import { MessageUpdated } from '@/contexts/conversations/domain/events/MessageUpdated'
import { MessageDeleted } from '@/contexts/conversations/domain/events/MessageDeleted'

export interface AudioPayload {
  url: string
  duration: string
  waveform: number[] | null
  transcription: string | null
  transcriptionEdited: boolean
}

interface MessageProps {
  conversationId: string
  authorId: string | null
  agentId: string | null
  content: string
  role: MessageRole
  metadata: JsonObject | null
  pinned: boolean
  starred: boolean
  deletedAt: Date | null
  deletedFor: string[]
  reactions: Reaction[]
  audio: AudioPayload | null
  createdAt: Date
}

export interface PostMessageInput {
  id: MessageId
  conversationId: string
  authorId: string | null
  agentId: string | null
  content: string
  role: MessageRole
  metadata: JsonObject | null
  audio: AudioPayload | null
  // Fan-out audience for the MessagePosted event (members minus the author).
  recipientIds: readonly string[]
  now: Date
}

export interface RehydrateMessageInput {
  id: MessageId
  conversationId: string
  authorId: string | null
  agentId: string | null
  content: string
  role: MessageRole
  metadata: JsonObject | null
  pinned: boolean
  starred: boolean
  deletedAt: Date | null
  deletedFor: string[]
  reactions: Reaction[]
  audio: AudioPayload | null
  createdAt: Date
}

// AGGREGATE ROOT. A single message. Guards a few invariants of its own:
//  - a message must carry text, an attachment, or audio (no empty messages);
//  - only the author may delete-for-everyone or edit an audio transcription;
//  - delete-for-everyone is a soft delete (deletedAt); delete-for-me adds the
//    user to deletedFor; visibility folds both.
// All mutations are PURE and record the WS fan-out event; IO lives in the use case.
export class Message extends AggregateRoot<MessageId> {
  private constructor(
    id: MessageId,
    private props: MessageProps,
  ) {
    super(id)
  }

  static post(input: PostMessageInput): Result<Message> {
    const hasText = input.content.trim().length > 0
    const hasAttachment = readAttachments(input.metadata).length > 0
    const hasAudio = input.audio !== null
    if (!hasText && !hasAttachment && !hasAudio) {
      return fail('Message: empty message')
    }
    const message = new Message(input.id, {
      conversationId: input.conversationId,
      authorId: input.authorId,
      agentId: input.agentId,
      content: input.content,
      role: input.role,
      metadata: input.metadata,
      pinned: false,
      starred: false,
      deletedAt: null,
      deletedFor: [],
      reactions: [],
      audio: input.audio,
      createdAt: input.now,
    })
    message.addEvent(
      new MessagePosted(
        input.id.value,
        input.conversationId,
        input.authorId,
        input.role,
        input.content,
        input.recipientIds,
        input.now,
      ),
    )
    return ok(message)
  }

  static rehydrate(input: RehydrateMessageInput): Message {
    return new Message(input.id, {
      conversationId: input.conversationId,
      authorId: input.authorId,
      agentId: input.agentId,
      content: input.content,
      role: input.role,
      metadata: input.metadata,
      pinned: input.pinned,
      starred: input.starred,
      deletedAt: input.deletedAt,
      deletedFor: [...input.deletedFor],
      reactions: [...input.reactions],
      audio: input.audio,
      createdAt: input.createdAt,
    })
  }

  get conversationId(): string {
    return this.props.conversationId
  }

  get authorId(): string | null {
    return this.props.authorId
  }

  get agentId(): string | null {
    return this.props.agentId
  }

  get content(): string {
    return this.props.content
  }

  get role(): MessageRole {
    return this.props.role
  }

  get metadata(): JsonObject | null {
    return this.props.metadata
  }

  get pinned(): boolean {
    return this.props.pinned
  }

  get starred(): boolean {
    return this.props.starred
  }

  get deletedAt(): Date | null {
    return this.props.deletedAt
  }

  get deletedFor(): readonly string[] {
    return this.props.deletedFor
  }

  get reactions(): readonly Reaction[] {
    return this.props.reactions
  }

  get audio(): AudioPayload | null {
    return this.props.audio
  }

  get createdAt(): Date {
    return this.props.createdAt
  }

  isAuthor(userId: string): boolean {
    return this.props.authorId === userId
  }

  isDeletedFor(userId: string): boolean {
    return this.props.deletedAt !== null || this.props.deletedFor.includes(userId)
  }

  // PURE toggle: pinned. Records a fan-out update for all members.
  togglePin(recipientIds: readonly string[], now: Date): boolean {
    this.props.pinned = !this.props.pinned
    this.addEvent(
      new MessageUpdated(this.id.value, this.props.conversationId, recipientIds, { pinned: this.props.pinned }, now),
    )
    return this.props.pinned
  }

  // PURE toggle: starred (personal flag, still broadcast to members like the source).
  toggleStar(recipientIds: readonly string[], now: Date): boolean {
    this.props.starred = !this.props.starred
    this.addEvent(
      new MessageUpdated(this.id.value, this.props.conversationId, recipientIds, { starred: this.props.starred }, now),
    )
    return this.props.starred
  }

  // PURE toggle: emoji reaction by a user.
  react(userId: string, emoji: string, recipientIds: readonly string[], now: Date): Reaction[] {
    this.props.reactions = toggleReaction(this.props.reactions, emoji, userId)
    this.addEvent(
      new MessageUpdated(
        this.id.value,
        this.props.conversationId,
        recipientIds,
        { reactions: this.props.reactions },
        now,
      ),
    )
    return this.props.reactions
  }

  // Soft delete for everyone. Author-only. Idempotent (already-deleted stays deleted).
  deleteForEveryone(byUserId: string, recipientIds: readonly string[], now: Date): Result<void> {
    if (!this.isAuthor(byUserId)) {
      return fail('Only the author can delete this message for everyone')
    }
    this.props.deletedAt = now
    this.addEvent(new MessageDeleted(this.id.value, this.props.conversationId, recipientIds, now))
    return ok(undefined)
  }

  // Per-user hide. No event: other members are unaffected.
  deleteForMe(userId: string): void {
    if (!this.props.deletedFor.includes(userId)) {
      this.props.deletedFor.push(userId)
    }
  }

  // Author-only edit of an audio transcription. Sets the "edited" flag. Mirrors
  // the source: only the transcription columns change (content is untouched).
  editTranscription(byUserId: string, transcription: string): Result<void> {
    if (!this.isAuthor(byUserId)) {
      return fail('Not the author')
    }
    if (!this.props.audio) {
      return fail('Message has no audio to transcribe')
    }
    this.props.audio = { ...this.props.audio, transcription, transcriptionEdited: true }
    return ok(undefined)
  }

  // Flip the quickReplies block to answered (no-op when absent). No event.
  markQuickReplyAnswered(): void {
    this.props.metadata = markQuickRepliesAnswered(this.props.metadata)
  }
}
