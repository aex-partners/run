import { and, eq } from "drizzle-orm";
import type { Database } from "../db/index.js";
import { agents, conversationMembers, conversations, users } from "../db/schema/index.js";

/**
 * Creates the default Eric agent + AI conversation and adds every existing user as a member
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

  const convId = crypto.randomUUID();
  await db.insert(conversations).values({
    id: convId,
    name: "Eric",
    type: "ai",
    agentId: ericId,
  });

  const everyone = await db.select({ id: users.id }).from(users);
  if (everyone.length === 0) return;

  await db
    .insert(conversationMembers)
    .values(everyone.map((u) => ({ conversationId: convId, userId: u.id })))
    .onConflictDoNothing();
}

/** Adds a user to the default Eric AI conversation when it exists (single workspace assistant). */
export async function addUserToEricConversation(db: Database, userId: string): Promise<void> {
  const [ericConv] = await db
    .select({ id: conversations.id })
    .from(conversations)
    .innerJoin(agents, eq(conversations.agentId, agents.id))
    .where(and(eq(agents.slug, "eric"), eq(conversations.type, "ai")))
    .limit(1);

  if (!ericConv) return;

  await db
    .insert(conversationMembers)
    .values({ conversationId: ericConv.id, userId })
    .onConflictDoNothing();
}
