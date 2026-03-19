import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getTestDb, cleanDb, seedTestUser, createToolContext, closeTestDb, TEST_USER_ID } from "../test/helpers.js";
import * as schema from "../db/schema/index.js";

vi.mock("../ws/index.js", () => ({
  sendToConversation: vi.fn(),
  sendToUser: vi.fn(),
  broadcast: vi.fn(),
  registerWebSocket: vi.fn(),
}));

vi.mock("../ai/client.js", async () => {
  const { createTestModel } = await import("../test/mock-model.js");
  const m = createTestModel({ text: "OK" });
  return { model: m, nanoModel: m, openaiProvider: { chat: () => m }, getModel: () => m };
});

describe("task-runner: structured task edge cases", () => {
  const db = getTestDb();

  beforeAll(async () => {
    await cleanDb();
    await seedTestUser(db);
  });

  beforeEach(async () => {
    const { sql } = await import("drizzle-orm");
    await db.execute(sql.raw(`DELETE FROM "task_logs"`));
    await db.execute(sql.raw(`DELETE FROM "tasks"`));
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it("structured task with empty structuredInput defaults to {}", async () => {
    const { runTask } = await import("./task-runner.js");

    const taskId = crypto.randomUUID();
    await db.insert(schema.tasks).values({
      id: taskId,
      title: "Empty input test",
      input: "test",
      createdBy: TEST_USER_ID,
      type: "structured",
      toolName: "list_entities",
      structuredInput: null,
      status: "running",
      startedAt: new Date(),
    });

    const result = await runTask(
      {
        id: taskId,
        title: "Empty input test",
        input: "test",
        conversationId: null,
        createdBy: TEST_USER_ID,
        type: "structured",
        agentId: null,
        toolName: "list_entities",
        structuredInput: null,
        outputSchema: null,
      },
      db as any,
    );

    const parsed = JSON.parse(result);
    expect(parsed.entities).toBeDefined();
  });

  it("structured task result is stringified when not a string", async () => {
    const { runTask } = await import("./task-runner.js");

    const taskId = crypto.randomUUID();
    await db.insert(schema.tasks).values({
      id: taskId,
      title: "Stringify test",
      input: "test",
      createdBy: TEST_USER_ID,
      type: "structured",
      toolName: "list_users",
      structuredInput: "{}",
      status: "running",
      startedAt: new Date(),
    });

    const result = await runTask(
      {
        id: taskId,
        title: "Stringify test",
        input: "test",
        conversationId: null,
        createdBy: TEST_USER_ID,
        type: "structured",
        agentId: null,
        toolName: "list_users",
        structuredInput: "{}",
        outputSchema: null,
      },
      db as any,
    );

    // Result should be valid JSON string
    expect(() => JSON.parse(result)).not.toThrow();
    const parsed = JSON.parse(result);
    expect(parsed.users).toBeDefined();
  });

  it("broadcast is called with progress updates", async () => {
    const { runTask } = await import("./task-runner.js");
    const { broadcast } = await import("../ws/index.js");

    vi.mocked(broadcast).mockClear();

    const taskId = crypto.randomUUID();
    await db.insert(schema.tasks).values({
      id: taskId,
      title: "Broadcast test",
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
        title: "Broadcast test",
        input: "test",
        conversationId: null,
        createdBy: TEST_USER_ID,
        type: "structured",
        agentId: null,
        toolName: "list_entities",
        structuredInput: "{}",
        outputSchema: null,
      },
      db as any,
    );

    // broadcast should have been called with task_updated
    const calls = vi.mocked(broadcast).mock.calls;
    const taskUpdates = calls.filter((c) => (c[0] as any)?.type === "task_updated");
    expect(taskUpdates.length).toBeGreaterThan(0);
    expect((taskUpdates[0][0] as any).task.progress).toBe(100);
  });
});
