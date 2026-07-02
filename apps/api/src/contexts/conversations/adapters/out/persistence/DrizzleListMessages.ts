import { and, desc, eq, lt, isNull } from 'drizzle-orm'
import { DEFAULT_AGENT_NAME } from '@aex/shared'
import { Json, isJsonObject } from '@/shared/domain/Json'
import { Database } from '@/platform/db/client'
import { messages, conversationMembers } from '@/platform/db/schema'
import {
  ListMessages,
  ListMessagesInput,
  ListMessagesResult,
  MessageView,
} from '@/contexts/conversations/application/queries/ListMessages'
import { NameResolver } from '@/contexts/conversations/application/ports/out/NameResolver'
import { MessageRole, isMessageRole } from '@/contexts/conversations/domain/MessageRole'
import { Reaction } from '@/contexts/conversations/domain/Reaction'

const parseJson = (raw: string | null): Json | undefined => {
  if (raw === null) return undefined
  try {
    return JSON.parse(raw) as Json
  } catch {
    return undefined
  }
}

const parseReactions = (raw: string | null): Reaction[] => {
  const v = parseJson(raw)
  if (!Array.isArray(v)) return []
  const out: Reaction[] = []
  for (const item of v) {
    if (isJsonObject(item) && typeof item.emoji === 'string' && typeof item.userId === 'string') {
      out.push({ emoji: item.emoji, userId: item.userId })
    }
  }
  return out
}

const parseStringList = (raw: string | null): string[] => {
  const v = parseJson(raw)
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

const parseWaveform = (raw: string | null): number[] | null => {
  const v = parseJson(raw)
  return Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number') : null
}

const asRole = (raw: string): MessageRole => (isMessageRole(raw) ? raw : 'user')

// Read-side adapter (CQRS). Ports `messages.list`: membership-scoped, newest-first,
// soft-deleted excluded, cursor-paginated, with the author name resolved
// (user -> agent -> default) and the caller's "delete for me" entries filtered out.
// Owns only the `messages` tables; the author name is resolved from authorId/agentId
// through the NameResolver ACL out-port (never by joining `users`/`agents` here).
export class DrizzleListMessages implements ListMessages {
  constructor(
    private readonly db: Database,
    private readonly names: NameResolver,
  ) {}

  async execute(input: ListMessagesInput): Promise<ListMessagesResult> {
    // Membership guard: a non-member reads nothing.
    const [member] = await this.db
      .select({ userId: conversationMembers.userId })
      .from(conversationMembers)
      .where(
        and(
          eq(conversationMembers.conversationId, input.conversationId),
          eq(conversationMembers.userId, input.userId),
        ),
      )
      .limit(1)
    if (!member) return { items: [], nextCursor: undefined }

    const where = input.cursor
      ? and(
          eq(messages.conversationId, input.conversationId),
          lt(messages.createdAt, new Date(input.cursor)),
          isNull(messages.deletedAt),
        )
      : and(eq(messages.conversationId, input.conversationId), isNull(messages.deletedAt))

    const rows = await this.db
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        authorId: messages.authorId,
        agentId: messages.agentId,
        metadata: messages.metadata,
        content: messages.content,
        role: messages.role,
        pinned: messages.pinned,
        starred: messages.starred,
        reactions: messages.reactions,
        deletedFor: messages.deletedFor,
        audioUrl: messages.audioUrl,
        audioDuration: messages.audioDuration,
        audioWaveform: messages.audioWaveform,
        audioTranscription: messages.audioTranscription,
        audioTranscriptionEdited: messages.audioTranscriptionEdited,
        createdAt: messages.createdAt,
      })
      .from(messages)
      .where(where)
      .orderBy(desc(messages.createdAt))
      .limit(input.limit + 1)

    let nextCursor: string | undefined
    if (rows.length > input.limit) {
      // Discard the look-ahead row and cursor on the LAST KEPT item, so the
      // next page (lt cursor) starts exactly at the discarded boundary row
      // instead of skipping it.
      rows.pop()
      const last = rows[rows.length - 1]
      if (last) nextCursor = last.createdAt.toISOString()
    }

    const visible = rows.filter((r) => !parseStringList(r.deletedFor).includes(input.userId))

    // Resolve author names (user -> agent -> default) through the ACL out-port,
    // batching the distinct ids of the surviving rows into one call each.
    const userIds = [...new Set(visible.flatMap((r) => (r.authorId ? [r.authorId] : [])))]
    const agentIds = [...new Set(visible.flatMap((r) => (r.agentId ? [r.agentId] : [])))]
    const [userNameById, agentNameById] = await Promise.all([
      this.names.userNames(userIds),
      this.names.agentNames(agentIds),
    ])
    const authorName = (authorId: string | null, agentId: string | null): string =>
      (authorId ? userNameById.get(authorId) : undefined) ??
      (agentId ? agentNameById.get(agentId) : undefined) ??
      DEFAULT_AGENT_NAME

    const items = visible
      .map((r): MessageView => ({
        id: r.id,
        conversationId: r.conversationId,
        authorId: r.authorId,
        agentId: r.agentId,
        authorName: authorName(r.authorId, r.agentId),
        metadata: parseJson(r.metadata) ?? null,
        content: r.content,
        role: asRole(r.role),
        pinned: r.pinned === 1,
        starred: r.starred === 1,
        reactions: parseReactions(r.reactions),
        deletedFor: parseStringList(r.deletedFor),
        audioUrl: r.audioUrl,
        audioDuration: r.audioDuration,
        audioWaveform: parseWaveform(r.audioWaveform),
        audioTranscription: r.audioTranscription,
        audioTranscriptionEdited: r.audioTranscriptionEdited === 1,
        createdAt: r.createdAt,
      }))

    return { items, nextCursor }
  }
}
