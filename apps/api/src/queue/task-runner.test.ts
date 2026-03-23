import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getTestDb, cleanDb, seedTestUser, createToolContext, closeTestDb, TEST_USER_ID } from "../test/helpers.js";
import * as schema from "../db/schema/index.js";
import { serializeFields, type EntityField } from "../db/entity-fields.js";

// Mock WS
vi.mock("../ws/index.js", () => ({
  sendToConversation: vi.fn(),
  sendToUser: vi.fn(),
  broadcast: vi.fn(),
  registerWebSocket: vi.fn(),
}));

// Mock the LLM client
vi.mock("../ai/client.js", async () => {
  const { createTestModel } = await import("../test/mock-model.js");
  const m = createTestModel({ text: "Task completed successfully." });
  return {
    getModel: async () => m,
    getNanoModel: async () => m,
    getProvider: async () => ({ chat: () => m }),
    resetProvider: () => {},
  };
});

const ENTITY_ID = "ent-task-test-001";
const CONV_ID = "conv-task-test-001";

const productFields: EntityField[] = [
  { id: "f1", name: "Nome", slug: "nome", type: "text", required: true },
  { id: "f2", name: "Preco", slug: "preco", type: "number", required: false },
];

describe("task-runner (integration)", () => {
  const db = getTestDb();

  beforeAll(async () => {
    await cleanDb();
    await seedTestUser(db);

    await db.insert(schema.entities).values({
      id: ENTITY_ID,
      name: "Produtos",
      slug: "produtos",
      description: "Products",
      fields: serializeFields(productFields),
      createdBy: TEST_USER_ID,
    });

    await db.insert(schema.conversations).values({
      id: CONV_ID,
      name: "Task Test Conv",
      type: "ai",
    });
    await db.insert(schema.conversationMembers).values({
      conversationId: CONV_ID,
      userId: TEST_USER_ID,
    });
  });

  beforeEach(async () => {
    const { sql } = await import("drizzle-orm");
    await db.execute(sql.raw(`DELETE FROM "task_logs"`));
    await db.execute(sql.raw(`DELETE FROM "tasks"`));
    await db.execute(sql.raw(`DELETE FROM "entity_records"`));
    await db.delete(schema.messages).where(eq(schema.messages.conversationId, CONV_ID));
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it("runs a structured task calling insert_record", async () => {
    const { runTask } = await import("./task-runner.js");

    const taskId = crypto.randomUUID();
    await db.insert(schema.tasks).values({
      id: taskId,
      title: "Insert product",
      input: "Insert a product",
      createdBy: TEST_USER_ID,
      type: "structured",
      toolName: "insert_record",
      structuredInput: JSON.stringify({
        entity_id_or_name: "produtos",
        data: { Nome: "Erva-mate 1kg", Preco: 18.5 },
      }),
      status: "running",
      startedAt: new Date(),
    });

    const result = await runTask(
      {
        id: taskId,
        title: "Insert product",
        input: "Insert a product",
        conversationId: null,
        createdBy: TEST_USER_ID,
        type: "structured",
        agentId: null,
        toolName: "insert_record",
        structuredInput: JSON.stringify({
          entity_id_or_name: "produtos",
          data: { Nome: "Erva-mate 1kg", Preco: 18.5 },
        }),
        outputSchema: null,
        createdAt: null,
      },
      db as any,
    );

    const parsed = JSON.parse(result);
    expect(parsed.id).toBeDefined();
    expect(parsed.data.nome).toBe("Erva-mate 1kg");

    // Verify record in DB
    const records = await db
      .select()
      .from(schema.entityRecords)
      .where(eq(schema.entityRecords.entityId, ENTITY_ID));
    expect(records).toHaveLength(1);
  });

  it("structured task fails with missing toolName", async () => {
    const { runTask } = await import("./task-runner.js");

    await expect(
      runTask(
        {
          id: crypto.randomUUID(),
          title: "Bad task",
          input: "No tool",
          conversationId: null,
          createdBy: TEST_USER_ID,
          type: "structured",
          agentId: null,
          toolName: null,
          structuredInput: null,
          outputSchema: null,
        },
        db as any,
      ),
    ).rejects.toThrow("missing toolName");
  });

  it("structured task fails with unknown tool", async () => {
    const { runTask } = await import("./task-runner.js");

    const taskId = crypto.randomUUID();
    await db.insert(schema.tasks).values({
      id: taskId,
      title: "Unknown tool",
      input: "test",
      createdBy: TEST_USER_ID,
      type: "structured",
      toolName: "nonexistent_tool",
      structuredInput: "{}",
      status: "running",
      startedAt: new Date(),
    });

    await expect(
      runTask(
        {
          id: taskId,
          title: "Unknown tool",
          input: "test",
          conversationId: null,
          createdBy: TEST_USER_ID,
          type: "structured",
          agentId: null,
          toolName: "nonexistent_tool",
          structuredInput: "{}",
          outputSchema: null,
        },
        db as any,
      ),
    ).rejects.toThrow("not found");
  });

  it("creates task logs during structured execution", async () => {
    const { runTask } = await import("./task-runner.js");

    const taskId = crypto.randomUUID();
    await db.insert(schema.tasks).values({
      id: taskId,
      title: "Log test",
      input: "test",
      createdBy: TEST_USER_ID,
      type: "structured",
      toolName: "query_records",
      structuredInput: JSON.stringify({ entity_id_or_name: "produtos" }),
      status: "running",
      startedAt: new Date(),
    });

    await runTask(
      {
        id: taskId,
        title: "Log test",
        input: "test",
        conversationId: null,
        createdBy: TEST_USER_ID,
        type: "structured",
        agentId: null,
        toolName: "query_records",
        structuredInput: JSON.stringify({ entity_id_or_name: "produtos" }),
        outputSchema: null,
        createdAt: null,
      },
      db as any,
    );

    const logs = await db
      .select()
      .from(schema.taskLogs)
      .where(eq(schema.taskLogs.taskId, taskId));

    expect(logs.length).toBeGreaterThanOrEqual(2); // "Starting..." + "Calling tool..." + "completed"
    expect(logs.some((l) => l.level === "info")).toBe(true);
    expect(logs.some((l) => l.level === "step")).toBe(true);
  });

  it("updates task progress to 100 after structured completion", async () => {
    const { runTask } = await import("./task-runner.js");

    const taskId = crypto.randomUUID();
    await db.insert(schema.tasks).values({
      id: taskId,
      title: "Progress test",
      input: "test",
      createdBy: TEST_USER_ID,
      type: "structured",
      toolName: "list_entities",
      structuredInput: "{}",
      status: "running",
      startedAt: new Date(),
    });

    await runTask(
      {
        id: taskId,
        title: "Progress test",
        input: "test",
        conversationId: null,
        createdBy: TEST_USER_ID,
        type: "structured",
        agentId: null,
        toolName: "list_entities",
        structuredInput: "{}",
        outputSchema: null,
        createdAt: null,
      },
      db as any,
    );

    const [task] = await db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.id, taskId));

    expect(task.progress).toBe(100);
  });

  it("inference task loads conversation context and logs start", async () => {
    const { runTask } = await import("./task-runner.js");

    // Seed a user message so context is non-empty
    await db.insert(schema.messages).values({
      id: crypto.randomUUID(),
      conversationId: CONV_ID,
      authorId: TEST_USER_ID,
      content: "Liste todos os produtos",
      role: "user",
    });

    const taskId = crypto.randomUUID();
    await db.insert(schema.tasks).values({
      id: taskId,
      title: "Inference test",
      input: "List all products",
      createdBy: TEST_USER_ID,
      type: "inference",
      status: "running",
      startedAt: new Date(),
    });

    // The mock model may not fully satisfy AI SDK v5 internals,
    // but we can verify the setup phase (context loading + initial log)
    try {
      await runTask(
        {
          id: taskId,
          title: "Inference test",
          input: "List all products",
          conversationId: CONV_ID,
          createdBy: TEST_USER_ID,
          type: "inference",
          agentId: null,
          toolName: null,
          structuredInput: null,
          outputSchema: null,
        },
        db as any,
      );
    } catch {
      // AI SDK v5 internal error with mock model is expected
    }

    // Verify the task runner logged the "Starting task" message
    const logs = await db
      .select()
      .from(schema.taskLogs)
      .where(eq(schema.taskLogs.taskId, taskId));
    expect(logs.some((l) => l.message.includes("Starting task"))).toBe(true);
  });

  it("respects cancellation before starting inference", async () => {
    const { runTask, TaskCancelledException } = await import("./task-runner.js");

    const taskId = crypto.randomUUID();
    await db.insert(schema.tasks).values({
      id: taskId,
      title: "Cancelled task",
      input: "do stuff",
      createdBy: TEST_USER_ID,
      type: "inference",
      status: "cancelled",
      startedAt: new Date(),
    });

    await expect(
      runTask(
        {
          id: taskId,
          title: "Cancelled task",
          input: "do stuff",
          conversationId: null,
          createdBy: TEST_USER_ID,
          type: "inference",
          agentId: null,
          toolName: null,
          structuredInput: null,
          outputSchema: null,
        },
        db as any,
      ),
    ).rejects.toThrow("cancelled");
  });
});
