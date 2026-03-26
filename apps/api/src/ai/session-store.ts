import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { conversations } from "../db/schema/index.js";

export async function getSessionId(conversationId: string): Promise<string | null> {
  const [row] = await db
    .select({ sessionId: conversations.sessionId })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  return row?.sessionId ?? null;
}

export async function saveSessionId(conversationId: string, sessionId: string): Promise<void> {
  await db
    .update(conversations)
    .set({ sessionId, updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));
}
