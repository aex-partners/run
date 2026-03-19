import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { getTestDb, cleanDb, seedTestUser, closeTestDb, TEST_USER_ID } from "../test/helpers.js";
import * as schema from "../db/schema/index.js";

// Mock WS
vi.mock("../ws/index.js", () => ({
  sendToConversation: vi.fn(),
  sendToUser: vi.fn(),
  broadcast: vi.fn(),
  registerWebSocket: vi.fn(),
}));

// Mock workflow queue (avoid real BullMQ connection for cron tests)
vi.mock("../queue/workflow-queue.js", () => ({
  workflowQueue: {
    add: vi.fn(),
    getRepeatableJobs: vi.fn().mockResolvedValue([]),
    removeRepeatableByKey: vi.fn(),
  },
  enqueueWorkflowExecution: vi.fn(),
}));

describe("triggers", () => {
  const db = getTestDb();

  beforeAll(async () => {
    await cleanDb();
    await seedTestUser(db);
  });

  beforeEach(async () => {
    const { sql } = await import("drizzle-orm");
    await db.execute(sql.raw(`DELETE FROM "workflow_executions"`));
    await db.execute(sql.raw(`DELETE FROM "workflows"`));
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it("registerEventTrigger + checkEventTriggers fires on match", async () => {
    const { registerEventTrigger, checkEventTriggers, unregisterEventTrigger } = await import("./triggers.js");
    const { enqueueWorkflowExecution } = await import("../queue/workflow-queue.js");

    const wfId = "wf-event-001";
    await db.insert(schema.workflows).values({
      id: wfId,
      name: "Event WF",
      slug: "event-wf",
      status: "active",
      triggerType: "event",
      triggerConfig: JSON.stringify({ eventType: "record_updated", entityId: "ent-123" }),
      graph: '{"nodes":[],"edges":[]}',
      createdBy: TEST_USER_ID,
    });

    registerEventTrigger(wfId, { eventType: "record_updated", entityId: "ent-123" });

    await checkEventTriggers("record_updated", { entityId: "ent-123" }, db as any);

    expect(enqueueWorkflowExecution).toHaveBeenCalled();

    unregisterEventTrigger(wfId);
  });

  it("checkEventTriggers does not fire on non-matching event", async () => {
    const { registerEventTrigger, checkEventTriggers, unregisterEventTrigger } = await import("./triggers.js");
    const { enqueueWorkflowExecution } = await import("../queue/workflow-queue.js");

    const wfId = "wf-event-002";
    await db.insert(schema.workflows).values({
      id: wfId,
      name: "Event WF 2",
      slug: "event-wf-2",
      status: "active",
      triggerType: "event",
      triggerConfig: JSON.stringify({ eventType: "record_updated", entityId: "ent-999" }),
      graph: '{"nodes":[],"edges":[]}',
      createdBy: TEST_USER_ID,
    });

    registerEventTrigger(wfId, { eventType: "record_updated", entityId: "ent-999" });

    // Clear previous calls
    vi.mocked(enqueueWorkflowExecution).mockClear();

    // Different entityId
    await checkEventTriggers("record_updated", { entityId: "ent-000" }, db as any);
    expect(enqueueWorkflowExecution).not.toHaveBeenCalled();

    // Different eventType
    await checkEventTriggers("entity_updated", { entityId: "ent-999" }, db as any);
    expect(enqueueWorkflowExecution).not.toHaveBeenCalled();

    unregisterEventTrigger(wfId);
  });

  it("registerCronTrigger calls workflowQueue.add with repeat pattern", async () => {
    const { registerCronTrigger } = await import("./triggers.js");
    const { workflowQueue } = await import("../queue/workflow-queue.js");

    await registerCronTrigger("wf-cron-001", "0 9 * * *");

    expect(workflowQueue.add).toHaveBeenCalledWith(
      "cron-trigger",
      { workflowId: "wf-cron-001" },
      expect.objectContaining({
        repeat: { pattern: "0 9 * * *" },
        jobId: "cron-wf-cron-001",
      }),
    );
  });

  it("loadActiveTriggers registers cron and event triggers from DB", async () => {
    const { loadActiveTriggers, unregisterEventTrigger } = await import("./triggers.js");
    const { workflowQueue } = await import("../queue/workflow-queue.js");

    vi.mocked(workflowQueue.add).mockClear();

    await db.insert(schema.workflows).values({
      id: "wf-active-cron",
      name: "Active Cron",
      slug: "active-cron",
      status: "active",
      triggerType: "cron",
      triggerConfig: JSON.stringify({ cronExpression: "*/5 * * * *" }),
      graph: '{"nodes":[],"edges":[]}',
      createdBy: TEST_USER_ID,
    });

    await db.insert(schema.workflows).values({
      id: "wf-active-event",
      name: "Active Event",
      slug: "active-event",
      status: "active",
      triggerType: "event",
      triggerConfig: JSON.stringify({ eventType: "record_updated" }),
      graph: '{"nodes":[],"edges":[]}',
      createdBy: TEST_USER_ID,
    });

    await loadActiveTriggers(db as any);

    expect(workflowQueue.add).toHaveBeenCalled();

    // Cleanup
    unregisterEventTrigger("wf-active-event");
  });
});
