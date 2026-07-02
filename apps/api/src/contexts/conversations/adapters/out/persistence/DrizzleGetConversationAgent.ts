import { eq } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { conversations } from '@/platform/db/schema'
import { GetConversationAgent } from '@/contexts/conversations/application/ports/in/GetConversationAgent'

// Read-side adapter (CQRS) fulfilling the GetConversationAgent provider in-port.
// Reads the conversations context's OWN `conversations` table and returns the
// bound agentId (null when the conversation has no agent or does not exist).
export class DrizzleGetConversationAgent implements GetConversationAgent {
  constructor(private readonly db: Database) {}

  async execute(conversationId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ agentId: conversations.agentId })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1)

    return row?.agentId ?? null
  }
}
