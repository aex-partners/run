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

vi.mock("../queue/task-queue.js", () => ({
  enqueueTask: vi.fn(),
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

// ---------------------------------------------------------------------------
// create_task
// ---------------------------------------------------------------------------
describe("tools: create_task", () => {
  beforeEach(async () => {
    const { sql } = await import("drizzle-orm");
    await db.execute(sql.raw(`DELETE FROM "task_logs"`));
    await db.execute(sql.raw(`DELETE FROM "tasks"`));
    await db.execute(sql.raw(`DELETE FROM "conversation_members"`));
    await db.execute(sql.raw(`DELETE FROM "conversations"`));
    // Ensure a conversation exists for the context's conversationId
    await db.insert(schema.conversations).values({ id: "test-conv-001", name: "Test", type: "ai" });
    await db.insert(schema.conversationMembers).values({ conversationId: "test-conv-001", userId: TEST_USER_ID });
  });

  it("creates an immediate task and persists it in DB", async () => {
    const result = await tools.create_task.execute(
      { title: "Generate report", description: "Build monthly sales report" },
      { toolCallId: "tc1" },
    );

    expect(result.id).toBeDefined();
    expect(result.title).toBe("Generate report");
    expect(result.status).toBe("pending");
    expect(result.scheduledAt).toBeNull();

    const [row] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, result.id));
    expect(row).toBeDefined();
    expect(row.title).toBe("Generate report");
    expect(row.description).toBe("Build monthly sales report");
    expect(row.createdBy).toBe(TEST_USER_ID);
    expect(row.conversationId).toBe("test-conv-001");
    expect(row.scheduledAt).toBeNull();
    expect(row.type).toBe("inference");
  });

  it("creates a scheduled task with scheduledAt set", async () => {
    const before = Date.now();

    const result = await tools.create_task.execute(
      { title: "Scheduled cleanup", description: "Remove stale records", schedule_in_minutes: 5 },
      { toolCallId: "tc2" },
    );

    expect(result.scheduledAt).toBeDefined();
    expect(result.scheduledAt).not.toBeNull();

    const [row] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, result.id));
    expect(row.scheduledAt).toBeDefined();

    const scheduledMs = new Date(row.scheduledAt!).getTime();
    // scheduledAt should be roughly 5 min from now (give 10s tolerance)
    expect(scheduledMs).toBeGreaterThanOrEqual(before + 5 * 60_000 - 10_000);
    expect(scheduledMs).toBeLessThanOrEqual(Date.now() + 5 * 60_000 + 10_000);
  });

  it("creates a structured task with tool_name and structured_input", async () => {
    const result = await tools.create_task.execute(
      {
        title: "Bulk insert",
        description: "Insert records via tool",
        type: "structured",
        tool_name: "insert_record",
        structured_input: { entity_id_or_name: "products", data: { nome: "Widget" } },
      },
      { toolCallId: "tc3" },
    );

    expect(result.type).toBe("structured");

    const [row] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, result.id));
    expect(row.type).toBe("structured");
    expect(row.toolName).toBe("insert_record");
    expect(row.structuredInput).toBeDefined();
    const parsed = JSON.parse(row.structuredInput!);
    expect(parsed.entity_id_or_name).toBe("products");
  });
});

// ---------------------------------------------------------------------------
// list_tasks
// ---------------------------------------------------------------------------
describe("tools: list_tasks", () => {
  beforeEach(async () => {
    const { sql } = await import("drizzle-orm");
    await db.execute(sql.raw(`DELETE FROM "task_logs"`));
    await db.execute(sql.raw(`DELETE FROM "tasks"`));
    await db.execute(sql.raw(`DELETE FROM "conversation_members"`));
    await db.execute(sql.raw(`DELETE FROM "conversations"`));
    await db.insert(schema.conversations).values({ id: "test-conv-001", name: "Test", type: "ai" });
    await db.insert(schema.conversationMembers).values({ conversationId: "test-conv-001", userId: TEST_USER_ID });
  });

  it("lists all tasks", async () => {
    await db.insert(schema.tasks).values([
      { id: "t1", title: "Task A", input: "do A", createdBy: TEST_USER_ID, status: "pending" },
      { id: "t2", title: "Task B", input: "do B", createdBy: TEST_USER_ID, status: "completed" },
    ]);

    const result = await tools.list_tasks.execute({}, { toolCallId: "tc4" });
    expect(result.tasks.length).toBe(2);
  });

  it("filters tasks by status", async () => {
    await db.insert(schema.tasks).values([
      { id: "t3", title: "Pending", input: "x", createdBy: TEST_USER_ID, status: "pending" },
      { id: "t4", title: "Done", input: "y", createdBy: TEST_USER_ID, status: "completed" },
      { id: "t5", title: "Also pending", input: "z", createdBy: TEST_USER_ID, status: "pending" },
    ]);

    const result = await tools.list_tasks.execute({ status: "pending" }, { toolCallId: "tc5" });
    expect(result.tasks.length).toBe(2);
    expect(result.tasks.every((t: any) => t.status === "pending")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// cancel_task
// ---------------------------------------------------------------------------
describe("tools: cancel_task", () => {
  beforeEach(async () => {
    const { sql } = await import("drizzle-orm");
    await db.execute(sql.raw(`DELETE FROM "task_logs"`));
    await db.execute(sql.raw(`DELETE FROM "tasks"`));
  });

  it("cancels a pending task", async () => {
    await db.insert(schema.tasks).values({
      id: "t-cancel-1",
      title: "Cancellable",
      input: "work",
      createdBy: TEST_USER_ID,
      status: "pending",
    });

    const result = await tools.cancel_task.execute({ task_id: "t-cancel-1" }, { toolCallId: "tc6" });
    expect(result).toHaveProperty("status", "cancelled");

    const [row] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, "t-cancel-1"));
    expect(row.status).toBe("cancelled");
    expect(row.completedAt).toBeDefined();
  });

  it("returns error when cancelling a completed task", async () => {
    await db.insert(schema.tasks).values({
      id: "t-cancel-2",
      title: "Already done",
      input: "work",
      createdBy: TEST_USER_ID,
      status: "completed",
    });

    const result = await tools.cancel_task.execute({ task_id: "t-cancel-2" }, { toolCallId: "tc7" });
    expect(result).toHaveProperty("error");
    expect(result.error).toContain("completed");
  });

  it("returns error for non-existent task", async () => {
    const result = await tools.cancel_task.execute({ task_id: "does-not-exist" }, { toolCallId: "tc8" });
    expect(result).toHaveProperty("error", "Task not found");
  });
});

// ---------------------------------------------------------------------------
// list_agents
// ---------------------------------------------------------------------------
describe("tools: list_agents", () => {
  beforeEach(async () => {
    const { sql } = await import("drizzle-orm");
    await db.execute(sql.raw(`DELETE FROM "agents"`));
  });

  it("returns seeded agents", async () => {
    await db.insert(schema.agents).values({
      id: "agent-1",
      name: "Sales Bot",
      slug: "sales-bot",
      systemPrompt: "You are a sales assistant.",
      modelId: "gpt-4o",
      createdBy: TEST_USER_ID,
    });

    const result = await tools.list_agents.execute({}, { toolCallId: "tc9" });
    expect(result.agents.length).toBeGreaterThanOrEqual(1);

    const agent = result.agents.find((a: any) => a.id === "agent-1");
    expect(agent).toBeDefined();
    expect(agent.name).toBe("Sales Bot");
    expect(agent.slug).toBe("sales-bot");
    expect(agent.modelId).toBe("gpt-4o");
  });
});

// ---------------------------------------------------------------------------
// assign_agent
// ---------------------------------------------------------------------------
describe("tools: assign_agent", () => {
  beforeEach(async () => {
    const { sql } = await import("drizzle-orm");
    await db.execute(sql.raw(`DELETE FROM "messages"`));
    await db.execute(sql.raw(`DELETE FROM "conversation_members"`));
    await db.execute(sql.raw(`DELETE FROM "conversations"`));
    await db.execute(sql.raw(`DELETE FROM "agents"`));
    await db.insert(schema.conversations).values({ id: "test-conv-001", name: "Test", type: "ai" });
    await db.insert(schema.conversationMembers).values({ conversationId: "test-conv-001", userId: TEST_USER_ID });
  });

  it("assigns an agent to the conversation", async () => {
    await db.insert(schema.agents).values({
      id: "agent-assign-1",
      name: "Helper",
      slug: "helper",
      systemPrompt: "Help users.",
      createdBy: TEST_USER_ID,
    });

    const result = await tools.assign_agent.execute({ agent_id: "agent-assign-1" }, { toolCallId: "tc10" });
    expect(result.agentId).toBe("agent-assign-1");
    expect(result.conversationId).toBe("test-conv-001");

    const [conv] = await db.select().from(schema.conversations).where(eq(schema.conversations.id, "test-conv-001"));
    expect(conv.agentId).toBe("agent-assign-1");
  });

  it("resets agent to default when null is passed", async () => {
    // First assign an agent
    await db.insert(schema.agents).values({
      id: "agent-assign-2",
      name: "Temp",
      slug: "temp",
      systemPrompt: "Temporary.",
      createdBy: TEST_USER_ID,
    });
    await tools.assign_agent.execute({ agent_id: "agent-assign-2" }, { toolCallId: "tc11" });

    // Now reset
    const result = await tools.assign_agent.execute({ agent_id: null }, { toolCallId: "tc12" });
    expect(result.agentId).toBeNull();
    expect(result.message).toContain("default");

    const [conv] = await db.select().from(schema.conversations).where(eq(schema.conversations.id, "test-conv-001"));
    expect(conv.agentId).toBeNull();
  });

  it("returns error when no conversation context", async () => {
    const noConvTools = createTools(createToolContext(db, { conversationId: undefined }));
    const result = await noConvTools.assign_agent.execute({ agent_id: "any" }, { toolCallId: "tc13" });
    expect(result).toHaveProperty("error", "No conversation context");
  });
});

// ---------------------------------------------------------------------------
// send_message
// ---------------------------------------------------------------------------
describe("tools: send_message", () => {
  beforeEach(async () => {
    const { sql } = await import("drizzle-orm");
    await db.execute(sql.raw(`DELETE FROM "messages"`));
    await db.execute(sql.raw(`DELETE FROM "conversation_members"`));
    await db.execute(sql.raw(`DELETE FROM "conversations"`));
    await db.insert(schema.conversations).values({ id: "test-conv-001", name: "Test", type: "ai" });
    await db.insert(schema.conversationMembers).values({ conversationId: "test-conv-001", userId: TEST_USER_ID });
  });

  it("sends a message and persists it in DB", async () => {
    const result = await tools.send_message.execute(
      { conversation_id: "test-conv-001", content: "Hello from tests!" },
      { toolCallId: "tc14" },
    );

    expect(result.id).toBeDefined();
    expect(result.conversationId).toBe("test-conv-001");

    const [msg] = await db.select().from(schema.messages).where(eq(schema.messages.id, result.id));
    expect(msg).toBeDefined();
    expect(msg.content).toBe("Hello from tests!");
    expect(msg.role).toBe("ai");
    expect(msg.conversationId).toBe("test-conv-001");
  });
});
