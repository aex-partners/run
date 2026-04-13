import { and, eq, isNull, or, sql } from "drizzle-orm";
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

/**
 * Save the new Claude Code session id for this conversation, but only when
 * the stored value still matches what we expected (CAS-style). This avoids
 * two concurrent turns on the same conversation stomping on each other's
 * session — the second saver now logs a warning and leaves the winning
 * session in place. Pass `expectedPrevious=null` to allow overwrite when the
 * column is empty (first session).
 */
export async function saveSessionId(
  conversationId: string,
  sessionId: string,
  expectedPrevious: string | null = null,
): Promise<boolean> {
  const updated = await db
    .update(conversations)
    .set({ sessionId, updatedAt: new Date() })
    .where(and(
      eq(conversations.id, conversationId),
      expectedPrevious === null
        ? or(isNull(conversations.sessionId), eq(conversations.sessionId, ""))
        : eq(conversations.sessionId, expectedPrevious),
    ))
    .returning({ id: conversations.id });

  if (updated.length === 0) {
    // Another concurrent turn already updated this conversation's session.
    // The caller's sessionId is now stale; we let whatever is currently in
    // the DB win so we don't zigzag between two Claude Code sessions.
    console.warn(
      `[session-store] saveSessionId raced on conversation ${conversationId} ` +
      `(expectedPrevious=${expectedPrevious ?? "<empty>"}); keeping current DB value`,
    );
    return false;
  }
  return true;
}

/** Force-clear the session (e.g. when the runtime told us the session was stale). */
export async function clearSessionId(conversationId: string): Promise<void> {
  await db
    .update(conversations)
    .set({ sessionId: sql`NULL`, updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));
}
