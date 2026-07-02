import { randomUUID } from 'node:crypto'
import { and, eq, inArray } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { conversations, conversationMembers } from '@/platform/db/schema'
import { ConversationRepository } from '@/contexts/conversations/application/ports/out/ConversationRepository'
import { Conversation } from '@/contexts/conversations/domain/Conversation'
import { ConversationId } from '@/contexts/conversations/domain/ids'
import { ConversationMapper } from '@/contexts/conversations/application/mappers/ConversationMapper'

// Driven adapter. Persists the `conversations` row (member rows are handled by
// DrizzleConversationMemberRepository). `findById` loads scalar state only.
export class DrizzleConversationRepository implements ConversationRepository {
  constructor(private readonly db: Database) {}

  nextId(): ConversationId {
    return ConversationId.of(randomUUID())
  }

  async findById(id: ConversationId): Promise<Conversation | null> {
    const [row] = await this.db.select().from(conversations).where(eq(conversations.id, id.value)).limit(1)
    return row ? ConversationMapper.toDomain(row) : null
  }

  async exists(id: ConversationId): Promise<boolean> {
    const [row] = await this.db
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.id, id.value))
      .limit(1)
    return !!row
  }

  async save(conversation: Conversation): Promise<void> {
    const row = ConversationMapper.toPersistence(conversation)
    await this.db
      .insert(conversations)
      .values(row)
      .onConflictDoUpdate({
        target: conversations.id,
        set: {
          name: row.name,
          type: row.type,
          agentId: row.agentId,
          sessionId: row.sessionId,
          updatedAt: row.updatedAt,
        },
      })
  }

  async saveIfAbsent(conversation: Conversation): Promise<void> {
    const row = ConversationMapper.toPersistence(conversation)
    await this.db.insert(conversations).values(row).onConflictDoNothing()
  }

  async delete(id: ConversationId): Promise<void> {
    await this.db.delete(conversations).where(eq(conversations.id, id.value))
  }

  // Existing DM between two users: a `dm` conversation both belong to.
  async findDmBetween(userAId: string, userBId: string): Promise<ConversationId | null> {
    const userAConvs = this.db
      .select({ id: conversationMembers.conversationId })
      .from(conversationMembers)
      .where(eq(conversationMembers.userId, userAId))

    const [existing] = await this.db
      .select({ id: conversations.id })
      .from(conversations)
      .innerJoin(conversationMembers, eq(conversationMembers.conversationId, conversations.id))
      .where(
        and(
          eq(conversations.type, 'dm'),
          eq(conversationMembers.userId, userBId),
          inArray(conversations.id, userAConvs),
        ),
      )
      .limit(1)

    return existing ? ConversationId.of(existing.id) : null
  }

  // The user's private Eric (ai) conversation bound to the given agent.
  async findEricConversation(agentId: string, userId: string): Promise<ConversationId | null> {
    const [existing] = await this.db
      .select({ id: conversations.id })
      .from(conversations)
      .innerJoin(conversationMembers, eq(conversations.id, conversationMembers.conversationId))
      .where(
        and(
          eq(conversations.agentId, agentId),
          eq(conversations.type, 'ai'),
          eq(conversationMembers.userId, userId),
        ),
      )
      .limit(1)

    return existing ? ConversationId.of(existing.id) : null
  }
}
