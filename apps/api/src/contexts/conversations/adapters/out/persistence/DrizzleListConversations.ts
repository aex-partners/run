import { and, desc, eq, inArray, ne, sql } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { conversations, conversationMembers, messages } from '@/platform/db/schema'
import { ListConversations, ConversationListItem } from '@/contexts/conversations/application/queries/ListConversations'
import { NameResolver } from '@/contexts/conversations/application/ports/out/NameResolver'

// Read-side adapter (CQRS). Ports the source `conversations.list` 1:1: every
// conversation the user is a member of, with its last message preview, unread
// count (messages after lastReadAt not authored by the user), personal flags, and
// for DMs the resolved peer display name. Owns only the conversations tables; the
// DM peer display name is resolved through the NameResolver ACL out-port (never by
// reading the `users` table here).
export class DrizzleListConversations implements ListConversations {
  constructor(
    private readonly db: Database,
    private readonly names: NameResolver,
  ) {}

  async execute(input: { userId: string }): Promise<ConversationListItem[]> {
    const userId = input.userId

    const memberships = await this.db
      .select({ conversationId: conversationMembers.conversationId })
      .from(conversationMembers)
      .where(eq(conversationMembers.userId, userId))

    if (memberships.length === 0) return []
    const ids = memberships.map((m) => m.conversationId)

    const lastMessageSq = this.db
      .select({
        conversationId: messages.conversationId,
        lastMessage: sql<string>`(array_agg(${messages.content} ORDER BY ${messages.createdAt} DESC))[1]`.as(
          'last_message',
        ),
        // Format as an explicit ISO-8601 UTC string (the column stores UTC). A
        // raw max() comes back as a tz-less string that `new Date()` would parse
        // in the process-local timezone, shifting the timestamp on non-UTC hosts.
        lastMessageAt: sql<string>`to_char(max(${messages.createdAt}), 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`.as('last_message_at'),
      })
      .from(messages)
      .where(inArray(messages.conversationId, ids))
      .groupBy(messages.conversationId)
      .as('lm')

    const rows = await this.db
      .select({
        id: conversations.id,
        name: conversations.name,
        type: conversations.type,
        agentId: conversations.agentId,
        createdAt: conversations.createdAt,
        lastMessage: lastMessageSq.lastMessage,
        lastMessageAt: lastMessageSq.lastMessageAt,
      })
      .from(conversations)
      .leftJoin(lastMessageSq, eq(conversations.id, lastMessageSq.conversationId))
      .where(inArray(conversations.id, ids))
      // lastMessageAt is now an ISO-8601 text; format createdAt the same way so
      // the coalesce types match and the lexical sort stays chronological.
      .orderBy(
        desc(
          sql`coalesce(${lastMessageSq.lastMessageAt}, to_char(${conversations.createdAt}, 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))`,
        ),
      )

    // Unread: messages after the user's lastReadAt, not authored by the user.
    const unreadRows = await this.db
      .select({
        conversationId: messages.conversationId,
        count: sql<number>`count(*)::int`,
      })
      .from(messages)
      .innerJoin(
        conversationMembers,
        and(
          eq(messages.conversationId, conversationMembers.conversationId),
          eq(conversationMembers.userId, userId),
        ),
      )
      .where(
        and(
          inArray(messages.conversationId, ids),
          sql`${messages.authorId} IS DISTINCT FROM ${userId}`,
          sql`${messages.createdAt} > ${conversationMembers.lastReadAt}`,
        ),
      )
      .groupBy(messages.conversationId)
    const unreadMap = new Map(unreadRows.map((r) => [r.conversationId, r.count]))

    // Personal flags (pinned/favorite/muted) for the caller.
    const flagRows = await this.db
      .select({
        conversationId: conversationMembers.conversationId,
        pinned: conversationMembers.pinned,
        favorite: conversationMembers.favorite,
        muted: conversationMembers.muted,
      })
      .from(conversationMembers)
      .where(and(inArray(conversationMembers.conversationId, ids), eq(conversationMembers.userId, userId)))
    const flagMap = new Map(flagRows.map((r) => [r.conversationId, r]))

    // DM peer display names (everyone but the caller). Read only our own
    // membership rows for the peer userIds, then resolve their names through the
    // ACL out-port (one batched call) — never by joining the `users` table.
    const dmIds = rows.filter((r) => r.type === 'dm').map((r) => r.id)
    const dmPeerNameByConv = new Map<string, string>()
    if (dmIds.length > 0) {
      const peerRows = await this.db
        .select({
          conversationId: conversationMembers.conversationId,
          userId: conversationMembers.userId,
        })
        .from(conversationMembers)
        .where(and(inArray(conversationMembers.conversationId, dmIds), ne(conversationMembers.userId, userId)))

      const peerIds = [...new Set(peerRows.map((p) => p.userId))]
      const nameById = await this.names.userNames(peerIds)

      const byConv = new Map<string, string[]>()
      for (const pr of peerRows) {
        const name = nameById.get(pr.userId)
        if (!name) continue
        const list = byConv.get(pr.conversationId) ?? []
        list.push(name)
        byConv.set(pr.conversationId, list)
      }
      for (const [convId, parts] of byConv) {
        dmPeerNameByConv.set(convId, parts.join(', '))
      }
    }

    return rows.map((r): ConversationListItem => {
      const flags = flagMap.get(r.id)
      const name =
        r.type === 'dm' ? (dmPeerNameByConv.get(r.id) ?? r.name ?? 'Direct message') : (r.name ?? '')
      return {
        id: r.id,
        name,
        type: r.type,
        agentId: r.agentId,
        createdAt: r.createdAt,
        lastMessage: r.lastMessage ?? '',
        lastMessageAt: r.lastMessageAt
          ? new Date(r.lastMessageAt).toISOString()
          : r.createdAt.toISOString(),
        unreadCount: unreadMap.get(r.id) ?? 0,
        pinned: flags?.pinned === 1,
        favorite: flags?.favorite === 1,
        muted: flags?.muted === 1,
      }
    })
  }
}
