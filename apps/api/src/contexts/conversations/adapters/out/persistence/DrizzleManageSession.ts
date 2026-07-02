import { and, eq, isNull } from 'drizzle-orm'
import { Database } from '@/platform/db/client'
import { conversations } from '@/platform/db/schema'
import { ManageSession, SaveSessionIdInput } from '@/contexts/conversations/application/ports/in/ManageSession'

// Driven adapter fulfilling the ManageSession provider in-port over the
// conversations context's OWN `conversations.session_id` column. `saveSessionId`
// implements optimistic CAS via a conditional UPDATE: the WHERE clause matches the
// row only when its current session id equals `expectedPrevious` (or is NULL when
// expectedPrevious is null), and `.returning()` tells us whether a row was written.
export class DrizzleManageSession implements ManageSession {
  constructor(private readonly db: Database) {}

  async getSessionId(conversationId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ sessionId: conversations.sessionId })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1)

    return row?.sessionId ?? null
  }

  async saveSessionId({ conversationId, sessionId, expectedPrevious }: SaveSessionIdInput): Promise<boolean> {
    const guard =
      expectedPrevious === null
        ? and(eq(conversations.id, conversationId), isNull(conversations.sessionId))
        : and(eq(conversations.id, conversationId), eq(conversations.sessionId, expectedPrevious))

    const written = await this.db
      .update(conversations)
      .set({ sessionId })
      .where(guard)
      .returning({ id: conversations.id })

    return written.length > 0
  }

  async clearSessionId(conversationId: string): Promise<void> {
    await this.db
      .update(conversations)
      .set({ sessionId: null })
      .where(eq(conversations.id, conversationId))
  }
}
