import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { getTestDb, cleanDb, seedTestUser, closeTestDb, TEST_USER_ID } from "../test/helpers.js";
import * as schema from "../db/schema/index.js";

describe("users (DB integration)", () => {
  const db = getTestDb();

  beforeAll(async () => {
    await cleanDb();
    await seedTestUser(db);
  });

  beforeEach(async () => {
    const { sql } = await import("drizzle-orm");
    // Clean extra users but keep the test user
    await db.execute(sql.raw(`DELETE FROM "conversation_members" WHERE "user_id" != '${TEST_USER_ID}'`));
    await db.execute(sql.raw(`DELETE FROM "conversations" WHERE "id" NOT IN (SELECT "conversation_id" FROM "conversation_members")`));
    await db.execute(sql.raw(`DELETE FROM "users" WHERE "id" != '${TEST_USER_ID}'`));
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it("creates a user with role", async () => {
    const userId = crypto.randomUUID();
    await db.insert(schema.users).values({
      id: userId,
      name: "Alice",
      email: "alice@aex.local",
      emailVerified: true,
      role: "user",
    });

    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
    expect(user.name).toBe("Alice");
    expect(user.role).toBe("user");
    expect(user.banned).toBe(false);
  });

  it("updates user role", async () => {
    const userId = crypto.randomUUID();
    await db.insert(schema.users).values({
      id: userId,
      name: "Bob",
      email: "bob@aex.local",
      emailVerified: true,
      role: "user",
    });

    await db
      .update(schema.users)
      .set({ role: "admin", updatedAt: new Date() })
      .where(eq(schema.users.id, userId));

    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
    expect(user.role).toBe("admin");
  });

  it("bans and unbans a user", async () => {
    const userId = crypto.randomUUID();
    await db.insert(schema.users).values({
      id: userId,
      name: "Carol",
      email: "carol@aex.local",
      emailVerified: true,
      role: "user",
    });

    // Ban
    await db
      .update(schema.users)
      .set({ banned: true, banReason: "Spam" })
      .where(eq(schema.users.id, userId));

    let [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
    expect(user.banned).toBe(true);
    expect(user.banReason).toBe("Spam");

    // Unban
    await db
      .update(schema.users)
      .set({ banned: false, banReason: null })
      .where(eq(schema.users.id, userId));

    [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
    expect(user.banned).toBe(false);
    expect(user.banReason).toBeNull();
  });

  it("deletes a user", async () => {
    const userId = crypto.randomUUID();
    await db.insert(schema.users).values({
      id: userId,
      name: "Dave",
      email: "dave@aex.local",
      emailVerified: true,
      role: "user",
    });

    await db.delete(schema.users).where(eq(schema.users.id, userId));

    const results = await db.select().from(schema.users).where(eq(schema.users.id, userId));
    expect(results).toHaveLength(0);
  });

  it("user email must be unique", async () => {
    await db.insert(schema.users).values({
      id: crypto.randomUUID(),
      name: "Eve1",
      email: "eve@aex.local",
      emailVerified: true,
    });

    await expect(
      db.insert(schema.users).values({
        id: crypto.randomUUID(),
        name: "Eve2",
        email: "eve@aex.local",
        emailVerified: true,
      }),
    ).rejects.toThrow();
  });

  it("invite creates user + DM conversation", async () => {
    const invitedId = crypto.randomUUID();
    await db.insert(schema.users).values({
      id: invitedId,
      name: "Frank",
      email: "frank@aex.local",
      emailVerified: true,
      role: "user",
    });

    // Create DM between inviter and invitee
    const convId = crypto.randomUUID();
    await db.insert(schema.conversations).values({
      id: convId,
      name: "Frank",
      type: "dm",
    });
    await db.insert(schema.conversationMembers).values([
      { conversationId: convId, userId: TEST_USER_ID },
      { conversationId: convId, userId: invitedId },
    ]);

    const members = await db
      .select()
      .from(schema.conversationMembers)
      .where(eq(schema.conversationMembers.conversationId, convId));
    expect(members).toHaveLength(2);

    const [conv] = await db
      .select()
      .from(schema.conversations)
      .where(eq(schema.conversations.id, convId));
    expect(conv.type).toBe("dm");
  });

  it("tracks createdBy on entities", async () => {
    const entityId = crypto.randomUUID();
    await db.insert(schema.entities).values({
      id: entityId,
      name: "Audit Test",
      slug: "audit-test",
      fields: "[]",
      createdBy: TEST_USER_ID,
    });

    const [entity] = await db
      .select()
      .from(schema.entities)
      .where(eq(schema.entities.id, entityId));
    expect(entity.createdBy).toBe(TEST_USER_ID);

    // Cleanup
    await db.delete(schema.entities).where(eq(schema.entities.id, entityId));
  });
});
