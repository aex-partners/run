import { and, eq } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { conversationMembers } from '@/platform/db/schema'
import { ConversationMemberRepository } from '@/contexts/conversations/application/ports/out/ConversationMemberRepository'
import { ConversationMember } from '@/contexts/conversations/domain/ConversationMember'
import { ConversationId } from '@/contexts/conversations/domain/ids'
import { ConversationMemberMapper } from '@/contexts/conversations/application/mappers/ConversationMemberMapper'

// Driven adapter for the `conversation_members` table. Membership guards and the
// personal flag/read-cursor toggles operate on a single row.
export class DrizzleConversationMemberRepository implements ConversationMemberRepository {
  constructor(private readonly db: Database) {}

  async findMember(conversationId: ConversationId, userId: string): Promise<ConversationMember | null> {
    const [row] = await this.db
      .select()
      .from(conversationMembers)
      .where(
        and(
          eq(conversationMembers.conversationId, conversationId.value),
          eq(conversationMembers.userId, userId),
        ),
      )
      .limit(1)
    return row ? ConversationMemberMapper.toDomain(row) : null
  }

  async listMemberIds(conversationId: ConversationId): Promise<string[]> {
    const rows = await this.db
      .select({ userId: conversationMembers.userId })
      .from(conversationMembers)
      .where(eq(conversationMembers.conversationId, conversationId.value))
    return rows.map((r) => r.userId)
  }

  async add(conversationId: ConversationId, members: readonly ConversationMember[]): Promise<void> {
    if (members.length === 0) return
    const values = members.map((m) => ConversationMemberMapper.toValues(conversationId.value, m))
    await this.db.insert(conversationMembers).values(values).onConflictDoNothing()
  }

  async save(conversationId: ConversationId, member: ConversationMember): Promise<void> {
    const values = ConversationMemberMapper.toValues(conversationId.value, member)
    await this.db
      .insert(conversationMembers)
      .values(values)
      .onConflictDoUpdate({
        target: [conversationMembers.conversationId, conversationMembers.userId],
        set: {
          lastReadAt: values.lastReadAt,
          pinned: values.pinned,
          favorite: values.favorite,
          muted: values.muted,
        },
      })
  }
}
