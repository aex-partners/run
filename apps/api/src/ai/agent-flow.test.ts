import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { getTestDb, cleanDb, seedTestUser, createToolContext, closeTestDb, TEST_USER_ID } from "../test/helpers.js";
import * as schema from "../db/schema/index.js";
import { eq } from "drizzle-orm";
import { serializeFields, type EntityField } from "../db/entity-fields.js";

// Mock WS
vi.mock("../ws/index.js", () => ({
  sendToConversation: vi.fn(),
  sendToUser: vi.fn(),
  broadcast: vi.fn(),
  registerWebSocket: vi.fn(),
}));

// Mock the LLM client module
vi.mock("./client.js", async () => {
  const { createTestModel } = await import("../test/mock-model.js");
  const m = createTestModel({ text: "OK, done." });
  return {
    getModel: async () => m,
    getNanoModel: async () => m,
    getProvider: async () => ({ chat: () => m }),
    resetProvider: () => {},
  };
});

const CONV_ID = "conv-flow-001";
const ENTITY_ID = "ent-flow-001";

const productFields: EntityField[] = [
  { id: "f1", name: "Nome", slug: "nome", type: "text", required: true },
  { id: "f2", name: "Preco", slug: "preco", type: "number", required: false },
];

describe("agent-flow (integration with mocked LLM)", () => {
  const db = getTestDb();

  beforeAll(async () => {
    await cleanDb();
    await seedTestUser(db);

    // Seed conversation
    await db.insert(schema.conversations).values({
      id: CONV_ID,
      name: "Test Flow Conv",
      type: "ai",
    });
    await db.insert(schema.conversationMembers).values({
      conversationId: CONV_ID,
      userId: TEST_USER_ID,
    });

    // Seed entity
    await db.insert(schema.entities).values({
      id: ENTITY_ID,
      name: "Produtos",
      slug: "produtos",
      description: "Products",
      fields: serializeFields(productFields),
      createdBy: TEST_USER_ID,
    });
  });

  beforeEach(async () => {
    const { sql } = await import("drizzle-orm");
    await db.execute(sql.raw(`DELETE FROM "entity_records"`));
    await db.execute(sql.raw(`DELETE FROM "messages" WHERE "conversation_id" = '${CONV_ID}'`));
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it("read-only tool (query_records) auto-executes", async () => {
    const { createTools, shouldAutoExecute } = await import("./tools.js");
    expect(shouldAutoExecute("query_records", false)).toBe(true);

    const tools = createTools(createToolContext(db));
    const result = await tools.query_records.execute(
      { entity_id_or_name: "produtos" },
      { toolCallId: "tc1" },
    );

    expect(result.entity).toBe("Produtos");
    expect(result.count).toBe(0);
  });

  it("mutating tool (insert_record) is not auto-executed", async () => {
    const { shouldAutoExecute } = await import("./tools.js");
    expect(shouldAutoExecute("insert_record", false)).toBe(false);
  });

  it("confirmAction flow: insert then verify in DB", async () => {
    // Simulate what confirmAction does: directly execute the tool
    const { createTools } = await import("./tools.js");
    const tools = createTools(createToolContext(db));

    const insertResult = await tools.insert_record.execute(
      { entity_id_or_name: "produtos", data: { Nome: "Chimarrão 500g", Preco: 25.9 } },
      { toolCallId: "tc2" },
    ) as any;

    expect(insertResult.error).toBeUndefined();
    expect(insertResult.id).toBeDefined();
    expect(insertResult.data.nome).toBe("Chimarrão 500g");

    // Verify record exists in DB
    const records = await db
      .select()
      .from(schema.entityRecords)
      .where(eq(schema.entityRecords.entityId, ENTITY_ID));

    expect(records).toHaveLength(1);
    const data = JSON.parse(records[0].data);
    expect(data.nome).toBe("Chimarrão 500g");
    expect(data.preco).toBe(25.9);
  });
});
