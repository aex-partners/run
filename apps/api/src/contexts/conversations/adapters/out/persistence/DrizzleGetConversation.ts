import { and, eq } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { conversations, conversationMembers } from '@/platform/db/schema'
import { GetConversation, ConversationView } from '@/contexts/conversations/application/queries/GetConversation'

// Read-side adapter (CQRS). Returns the conversation only when the caller is a
// member (the inner join enforces it); a non-member sees null.
export class DrizzleGetConversation implements GetConversation {
  constructor(private readonly db: Database) {}

  async execute(input: { id: string; userId: string }): Promise<ConversationView | null> {
    const [row] = await this.db
      .select({
        id: conversations.id,
        name: conversations.name,
        type: conversations.type,
        agentId: conversations.agentId,
        sessionId: conversations.sessionId,
        createdAt: conversations.createdAt,
        updatedAt: conversations.updatedAt,
      })
      .from(conversations)
      .innerJoin(
        conversationMembers,
        and(
          eq(conversationMembers.conversationId, conversations.id),
          eq(conversationMembers.userId, input.userId),
        ),
      )
      .where(eq(conversations.id, input.id))
      .limit(1)

    return row ?? null
  }
}
