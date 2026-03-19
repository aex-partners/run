import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { eq, and } from "drizzle-orm";
import { getTestDb, cleanDb, seedTestUser, closeTestDb, TEST_USER_ID } from "../test/helpers.js";
import * as schema from "../db/schema/index.js";

const USER_B_ID = "test-user-002";

describe("conversations (DB integration)", () => {
  const db = getTestDb();

  beforeAll(async () => {
    await cleanDb();
    await seedTestUser(db);
    await db.insert(schema.users).values({
      id: USER_B_ID,
      name: "User B",
      email: "b@aex.local",
      emailVerified: true,
      role: "user",
    }).onConflictDoNothing();
  });

  beforeEach(async () => {
    const { sql } = await import("drizzle-orm");
    await db.execute(sql.raw(`DELETE FROM "messages"`));
    await db.execute(sql.raw(`DELETE FROM "conversation_members"`));
    await db.execute(sql.raw(`DELETE FROM "conversations"`));
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it("creates a DM conversation with two members", async () => {
    const convId = crypto.randomUUID();
    await db.insert(schema.conversations).values({
      id: convId,
      name: "DM Test",
      type: "dm",
    });
    await db.insert(schema.conversationMembers).values([
      { conversationId: convId, userId: TEST_USER_ID },
      { conversationId: convId, userId: USER_B_ID },
    ]);

    const members = await db
      .select()
      .from(schema.conversationMembers)
      .where(eq(schema.conversationMembers.conversationId, convId));

    expect(members).toHaveLength(2);
  });

  it("creates a channel with multiple members", async () => {
    const convId = crypto.randomUUID();
    await db.insert(schema.conversations).values({
      id: convId,
      name: "General",
      type: "channel",
    });
    await db.insert(schema.conversationMembers).values([
      { conversationId: convId, userId: TEST_USER_ID },
      { conversationId: convId, userId: USER_B_ID },
    ]);

    const [conv] = await db
      .select()
      .from(schema.conversations)
      .where(eq(schema.conversations.id, convId));

    expect(conv.type).toBe("channel");
    expect(conv.name).toBe("General");
  });

  it("creates an AI conversation", async () => {
    const convId = crypto.randomUUID();
    await db.insert(schema.conversations).values({
      id: convId,
      name: "New conversation",
      type: "ai",
    });
    await db.insert(schema.conversationMembers).values({
      conversationId: convId,
      userId: TEST_USER_ID,
    });

    const [conv] = await db
      .select()
      .from(schema.conversations)
      .where(eq(schema.conversations.id, convId));

    expect(conv.type).toBe("ai");
  });

  it("persists messages in conversation history", async () => {
    const convId = crypto.randomUUID();
    await db.insert(schema.conversations).values({ id: convId, type: "dm" });
    await db.insert(schema.conversationMembers).values([
      { conversationId: convId, userId: TEST_USER_ID },
      { conversationId: convId, userId: USER_B_ID },
    ]);

    // User A sends
    await db.insert(schema.messages).values({
      id: crypto.randomUUID(),
      conversationId: convId,
      authorId: TEST_USER_ID,
      content: "Oi, tudo bem?",
      role: "user",
    });

    // User B replies
    await db.insert(schema.messages).values({
      id: crypto.randomUUID(),
      conversationId: convId,
      authorId: USER_B_ID,
      content: "Tudo sim!",
      role: "user",
    });

    const msgs = await db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.conversationId, convId));

    expect(msgs).toHaveLength(2);
    expect(msgs.map((m) => m.content)).toContain("Oi, tudo bem?");
    expect(msgs.map((m) => m.content)).toContain("Tudo sim!");
  });

  it("renames a conversation", async () => {
    const convId = crypto.randomUUID();
    await db.insert(schema.conversations).values({
      id: convId,
      name: "Old Name",
      type: "channel",
    });

    await db
      .update(schema.conversations)
      .set({ name: "New Name", updatedAt: new Date() })
      .where(eq(schema.conversations.id, convId));

    const [conv] = await db
      .select()
      .from(schema.conversations)
      .where(eq(schema.conversations.id, convId));

    expect(conv.name).toBe("New Name");
  });

  it("deletes a conversation cascading messages and members", async () => {
    const convId = crypto.randomUUID();
    await db.insert(schema.conversations).values({ id: convId, type: "ai" });
    await db.insert(schema.conversationMembers).values({
      conversationId: convId,
      userId: TEST_USER_ID,
    });
    await db.insert(schema.messages).values({
      id: crypto.randomUUID(),
      conversationId: convId,
      authorId: TEST_USER_ID,
      content: "test",
      role: "user",
    });

    await db.delete(schema.conversations).where(eq(schema.conversations.id, convId));

    const msgs = await db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.conversationId, convId));
    const members = await db
      .select()
      .from(schema.conversationMembers)
      .where(eq(schema.conversationMembers.conversationId, convId));

    expect(msgs).toHaveLength(0);
    expect(members).toHaveLength(0);
  });

  it("soft-deletes a message (deleteForEveryone)", async () => {
    const convId = crypto.randomUUID();
    await db.insert(schema.conversations).values({ id: convId, type: "dm" });

    const msgId = crypto.randomUUID();
    await db.insert(schema.messages).values({
      id: msgId,
      conversationId: convId,
      authorId: TEST_USER_ID,
      content: "to be deleted",
      role: "user",
    });

    await db
      .update(schema.messages)
      .set({ deletedAt: new Date() })
      .where(eq(schema.messages.id, msgId));

    const [msg] = await db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.id, msgId));

    expect(msg.deletedAt).not.toBeNull();
  });

  it("per-user delete (deleteForMe)", async () => {
    const convId = crypto.randomUUID();
    await db.insert(schema.conversations).values({ id: convId, type: "dm" });

    const msgId = crypto.randomUUID();
    await db.insert(schema.messages).values({
      id: msgId,
      conversationId: convId,
      authorId: USER_B_ID,
      content: "visible to B only",
      role: "user",
    });

    const deletedFor = JSON.stringify([TEST_USER_ID]);
    await db
      .update(schema.messages)
      .set({ deletedFor })
      .where(eq(schema.messages.id, msgId));

    const [msg] = await db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.id, msgId));

    const ids: string[] = JSON.parse(msg.deletedFor!);
    expect(ids).toContain(TEST_USER_ID);
    expect(ids).not.toContain(USER_B_ID);
  });

  it("toggles message pin", async () => {
    const convId = crypto.randomUUID();
    await db.insert(schema.conversations).values({ id: convId, type: "channel" });

    const msgId = crypto.randomUUID();
    await db.insert(schema.messages).values({
      id: msgId,
      conversationId: convId,
      authorId: TEST_USER_ID,
      content: "important",
      role: "user",
    });

    // Pin
    await db.update(schema.messages).set({ pinned: 1 }).where(eq(schema.messages.id, msgId));
    let [msg] = await db.select().from(schema.messages).where(eq(schema.messages.id, msgId));
    expect(msg.pinned).toBe(1);

    // Unpin
    await db.update(schema.messages).set({ pinned: 0 }).where(eq(schema.messages.id, msgId));
    [msg] = await db.select().from(schema.messages).where(eq(schema.messages.id, msgId));
    expect(msg.pinned).toBe(0);
  });

  it("stores and toggles reactions", async () => {
    const convId = crypto.randomUUID();
    await db.insert(schema.conversations).values({ id: convId, type: "channel" });

    const msgId = crypto.randomUUID();
    await db.insert(schema.messages).values({
      id: msgId,
      conversationId: convId,
      authorId: TEST_USER_ID,
      content: "react to this",
      role: "user",
    });

    // Add reaction
    const reactions = [{ emoji: "👍", userId: USER_B_ID }];
    await db.update(schema.messages).set({ reactions: JSON.stringify(reactions) }).where(eq(schema.messages.id, msgId));

    const [msg] = await db.select().from(schema.messages).where(eq(schema.messages.id, msgId));
    const parsed = JSON.parse(msg.reactions!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].emoji).toBe("👍");
  });

  it("membership flags: pinned, favorite, muted", async () => {
    const convId = crypto.randomUUID();
    await db.insert(schema.conversations).values({ id: convId, type: "ai" });
    await db.insert(schema.conversationMembers).values({
      conversationId: convId,
      userId: TEST_USER_ID,
    });

    // Toggle pinned
    await db
      .update(schema.conversationMembers)
      .set({ pinned: 1 })
      .where(
        and(
          eq(schema.conversationMembers.conversationId, convId),
          eq(schema.conversationMembers.userId, TEST_USER_ID),
        ),
      );

    const [membership] = await db
      .select()
      .from(schema.conversationMembers)
      .where(eq(schema.conversationMembers.conversationId, convId));

    expect(membership.pinned).toBe(1);
    expect(membership.favorite).toBe(0);
    expect(membership.muted).toBe(0);
  });
});
