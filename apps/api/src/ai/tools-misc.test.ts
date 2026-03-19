import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getTestDb, cleanDb, seedTestUser, createToolContext, closeTestDb, TEST_USER_ID } from "../test/helpers.js";
import { createTools } from "./tools.js";
import * as schema from "../db/schema/index.js";

vi.mock("../ws/index.js", () => ({
  sendToConversation: vi.fn(),
  sendToUser: vi.fn(),
  broadcast: vi.fn(),
  registerWebSocket: vi.fn(),
}));

const db = getTestDb();
let tools: ReturnType<typeof createTools>;

beforeAll(async () => {
  await cleanDb();
  await seedTestUser(db);
  tools = createTools(createToolContext(db));
});

afterAll(async () => {
  await closeTestDb();
});

describe("tools: save_company_profile", () => {
  beforeEach(async () => {
    const { sql } = await import("drizzle-orm");
    await db.execute(sql.raw(`DELETE FROM "settings"`));
  });

  it("saves company profile to settings", async () => {
    const result = await tools.save_company_profile.execute(
      { name: "Buenaça", type: "retail", processes: ["sales", "inventory"], notes: "CTG store" },
      { toolCallId: "tc1" },
    );

    expect(result.saved).toBe(true);
    expect(result.profile.name).toBe("Buenaça");

    const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, "company_profile"));
    const profile = JSON.parse(row.value);
    expect(profile.type).toBe("retail");
    expect(profile.processes).toContain("sales");
  });

  it("upserts on conflict (saves twice)", async () => {
    await tools.save_company_profile.execute(
      { type: "retail", processes: ["sales"] },
      { toolCallId: "tc2" },
    );

    await tools.save_company_profile.execute(
      { name: "Updated Name", type: "services", processes: ["consulting"] },
      { toolCallId: "tc3" },
    );

    const rows = await db.select().from(schema.settings).where(eq(schema.settings.key, "company_profile"));
    expect(rows).toHaveLength(1);
    const profile = JSON.parse(rows[0].value);
    expect(profile.type).toBe("services");
    expect(profile.name).toBe("Updated Name");
  });
});

describe("tools: list_entities with record counts", () => {
  it("returns entities with correct record counts", async () => {
    const entityId = crypto.randomUUID();
    await db.insert(schema.entities).values({
      id: entityId,
      name: "CountTest",
      slug: "counttest",
      fields: '[{"id":"f1","name":"Nome","slug":"nome","type":"text","required":true}]',
      createdBy: TEST_USER_ID,
    });

    for (let i = 0; i < 3; i++) {
      await db.insert(schema.entityRecords).values({
        id: crypto.randomUUID(),
        entityId,
        data: JSON.stringify({ nome: `Record ${i}` }),
        createdBy: TEST_USER_ID,
      });
    }

    const result = await tools.list_entities.execute({}, { toolCallId: "tc4" });
    const entity = result.entities.find((e: any) => e.id === entityId);
    expect(entity).toBeDefined();
    expect(entity.recordCount).toBe(3);

    await db.delete(schema.entityRecords).where(eq(schema.entityRecords.entityId, entityId));
    await db.delete(schema.entities).where(eq(schema.entities.id, entityId));
  });
});

describe("tools: list_users", () => {
  it("returns all users with id, name, email, role", async () => {
    const result = await tools.list_users.execute({}, { toolCallId: "tc5" });
    expect(result.users.length).toBeGreaterThanOrEqual(1);
    const testUser = result.users.find((u: any) => u.id === TEST_USER_ID);
    expect(testUser).toBeDefined();
    expect(testUser.name).toBe("Test User");
    expect(testUser.email).toBe("test@aex.local");
  });
});

describe("tools: conversation CRUD via tools", () => {
  beforeEach(async () => {
    const { sql } = await import("drizzle-orm");
    await db.execute(sql.raw(`DELETE FROM "messages"`));
    await db.execute(sql.raw(`DELETE FROM "conversation_members"`));
    await db.execute(sql.raw(`DELETE FROM "conversations"`));
  });

  it("create_conversation creates AI conv with creator as member", async () => {
    const result = await tools.create_conversation.execute(
      { name: "Test Conv" },
      { toolCallId: "tc6" },
    );

    expect(result.id).toBeDefined();
    expect(result.name).toBe("Test Conv");

    const members = await db
      .select()
      .from(schema.conversationMembers)
      .where(eq(schema.conversationMembers.conversationId, result.id));
    expect(members).toHaveLength(1);
    expect(members[0].userId).toBe(TEST_USER_ID);
  });

  it("rename_conversation updates name", async () => {
    const created = await tools.create_conversation.execute({ name: "Old" }, { toolCallId: "tc7" });
    const result = await tools.rename_conversation.execute(
      { conversation_id: created.id, name: "New" },
      { toolCallId: "tc8" },
    );
    expect(result.name).toBe("New");
  });

  it("delete_conversation removes conversation", async () => {
    const created = await tools.create_conversation.execute({ name: "ToDelete" }, { toolCallId: "tc9" });
    const result = await tools.delete_conversation.execute(
      { conversation_id: created.id },
      { toolCallId: "tc10" },
    );
    expect(result.deleted).toBe(true);

    const rows = await db.select().from(schema.conversations).where(eq(schema.conversations.id, created.id));
    expect(rows).toHaveLength(0);
  });
});
