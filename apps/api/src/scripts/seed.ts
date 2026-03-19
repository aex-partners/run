import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "../../../../.env") });

const { db } = await import("../db/index.js");
const { auth } = await import("../auth/index.js");
const { users, conversations, conversationMembers } = await import("../db/schema/index.js");
const { agents } = await import("../db/schema/index.js");
const { eq } = await import("drizzle-orm");
const { DEFAULT_AGENT_ID, DEFAULT_AGENT_NAME, DEFAULT_AGENT_SLUG } = await import("@aex/shared");

const ADMIN_EMAIL = "admin@aex.app";
const ADMIN_PASSWORD = "admin123";
const ADMIN_NAME = "Admin";

async function seed() {
  console.log("Seeding database...");

  // --- Owner user ---
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, ADMIN_EMAIL))
    .limit(1);

  if (existing.length > 0) {
    // Ensure existing admin is promoted to owner
    await db
      .update(users)
      .set({ role: "owner" })
      .where(eq(users.email, ADMIN_EMAIL));
    console.log(`Owner user (${ADMIN_EMAIL}) already exists, ensured role=owner.`);
  } else {
    const res = await auth.api.signUpEmail({
      body: {
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      },
    });

    if (!res.user) {
      console.error("Failed to create owner user");
      process.exit(1);
    }

    await db
      .update(users)
      .set({ role: "owner" })
      .where(eq(users.id, res.user.id));

    console.log(`Owner user created: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  }

  // --- Default agent (Eric) ---
  const existingAgent = await db
    .select({ id: agents.id })
    .from(agents)
    .where(eq(agents.id, DEFAULT_AGENT_ID))
    .limit(1);

  if (existingAgent.length > 0) {
    console.log(`Default agent (${DEFAULT_AGENT_NAME}) already exists, skipping.`);
  } else {
    await db.insert(agents).values({
      id: DEFAULT_AGENT_ID,
      name: DEFAULT_AGENT_NAME,
      slug: DEFAULT_AGENT_SLUG,
      description: "Default AI assistant for RUN ERP",
      systemPrompt: "You are Eric, the default AI assistant inside RUN ERP.",
      isSystem: true,
      createdBy: null,
    });

    console.log(`Default agent created: ${DEFAULT_AGENT_NAME}`);
  }

  // --- Default conversation with Eric ---
  const [adminUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, ADMIN_EMAIL))
    .limit(1);

  if (adminUser) {
    const existingConv = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.agentId, DEFAULT_AGENT_ID))
      .limit(1);

    if (existingConv.length === 0) {
      const convId = crypto.randomUUID();
      await db.insert(conversations).values({
        id: convId,
        name: DEFAULT_AGENT_NAME,
        type: "ai",
        agentId: DEFAULT_AGENT_ID,
      });
      await db.insert(conversationMembers).values({
        conversationId: convId,
        userId: adminUser.id,
      });
      console.log(`Default conversation with ${DEFAULT_AGENT_NAME} created.`);
    } else {
      console.log(`Default conversation with ${DEFAULT_AGENT_NAME} already exists, skipping.`);
    }
  }

  console.log("Seed complete.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
