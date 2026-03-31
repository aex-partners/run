import { and, eq } from "drizzle-orm";
import type { Database } from "../db/index.js";
import { agents, conversationMembers, conversations, users } from "../db/schema/index.js";

/**
 * Creates a private Eric AI conversation for a single user.
 */
export async function createEricConversationForUser(
  db: Database,
  agentId: string,
  userId: string,
): Promise<string> {
  const convId = crypto.randomUUID();
  await db.insert(conversations).values({
    id: convId,
    name: "Eric",
    type: "ai",
    agentId,
  });
  await db.insert(conversationMembers).values({
    conversationId: convId,
    userId,
  });
  return convId;
}

/**
 * Creates the default Eric agent and one private AI conversation per existing user
 * when the workspace has no Eric yet (e.g. after db:seed without setup wizard).
 */
export async function ensureDefaultEricWorkspace(db: Database): Promise<void> {
  const [ericAgent] = await db.select({ id: agents.id }).from(agents).where(eq(agents.slug, "eric")).limit(1);
  if (ericAgent) return;

  const [owner] = await db.select({ id: users.id }).from(users).where(eq(users.role, "owner")).limit(1);
  const [anyUser] = await db.select({ id: users.id }).from(users).limit(1);
  const createdBy = owner?.id ?? anyUser?.id;
  if (!createdBy) return;

  const ericId = crypto.randomUUID();
  await db.insert(agents).values({
    id: ericId,
    name: "Eric",
    slug: "eric",
    description:
      "Your AI-powered ERP assistant. Eric helps manage tasks, query data, create entities, and automate workflows.",
    systemPrompt: "",
    skillIds: "[]",
    isSystem: true,
    createdBy,
  });

  // Create one private conversation per user
  const everyone = await db.select({ id: users.id }).from(users);
  for (const user of everyone) {
    await createEricConversationForUser(db, ericId, user.id);
  }
}

/**
 * Ensures a user has their own private Eric AI conversation.
 * Creates one if it doesn't exist yet. Returns the conversation ID, or null if Eric agent is missing.
 */
export async function ensureEricConversationForUser(db: Database, userId: string): Promise<string | null> {
  const [ericAgent] = await db.select({ id: agents.id }).from(agents).where(eq(agents.slug, "eric")).limit(1);
  if (!ericAgent) return null;

  // Check if this user already has their own Eric conversation
  const existing = await db
    .select({ id: conversations.id })
    .from(conversations)
    .innerJoin(conversationMembers, eq(conversations.id, conversationMembers.conversationId))
    .where(
      and(
        eq(conversations.agentId, ericAgent.id),
        eq(conversations.type, "ai"),
        eq(conversationMembers.userId, userId),
      ),
    )
    .limit(1);

  if (existing.length > 0) return existing[0].id;

  // Create new private conversation
  return createEricConversationForUser(db, ericAgent.id, userId);
}
