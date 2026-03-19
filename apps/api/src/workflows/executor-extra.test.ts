import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getTestDb, cleanDb, seedTestUser, closeTestDb, TEST_USER_ID } from "../test/helpers.js";
import * as schema from "../db/schema/index.js";
import { serializeFields, type EntityField } from "../db/entity-fields.js";
import { generateGraphFromSteps } from "./executor.js";

vi.mock("../ws/index.js", () => ({
  sendToConversation: vi.fn(),
  sendToUser: vi.fn(),
  broadcast: vi.fn(),
  registerWebSocket: vi.fn(),
}));

vi.mock("../ai/client.js", async () => {
  const { createTestModel } = await import("../test/mock-model.js");
  const m = createTestModel({ text: "Done." });
  return { model: m, nanoModel: m, openaiProvider: { chat: () => m }, getModel: () => m };
});

const ENTITY_ID = "ent-wf-extra-001";
const db = getTestDb();

beforeAll(async () => {
  await cleanDb();
  await seedTestUser(db);

  await db.insert(schema.entities).values({
    id: ENTITY_ID,
    name: "CondTest",
    slug: "condtest",
    fields: serializeFields([{ id: "f1", name: "Nome", slug: "nome", type: "text", required: true }]),
    createdBy: TEST_USER_ID,
  });
});

beforeEach(async () => {
  const { sql } = await import("drizzle-orm");
  await db.execute(sql.raw(`DELETE FROM "task_logs"`));
  await db.execute(sql.raw(`DELETE FROM "tasks"`));
  await db.execute(sql.raw(`DELETE FROM "workflow_executions"`));
  await db.execute(sql.raw(`DELETE FROM "workflows"`));
  await db.execute(sql.raw(`DELETE FROM "entity_records"`));
});

afterAll(async () => {
  await closeTestDb();
});

describe("evaluateCondition (via workflow execution)", () => {

  it("condition with empty records skips yes branch", async () => {
    const { executeWorkflow } = await import("./executor.js");

    // Query records (returns count:0) → condition → yes: insert / no: notify
    const nodes = [
      { id: "trigger-1", type: "trigger", position: { x: 0, y: 0 }, data: { label: "Trigger" } },
      {
        id: "action-1", type: "action", position: { x: 0, y: 120 },
        data: { label: "Query", taskType: "structured", toolName: "query_records", toolInput: { entity_id_or_name: "condtest" } },
      },
      { id: "condition-1", type: "condition", position: { x: 0, y: 240 }, data: { label: "Has records?" } },
      {
        id: "action-2", type: "action", position: { x: -100, y: 360 },
        data: { label: "Insert fallback", taskType: "structured", toolName: "insert_record", toolInput: { entity_id_or_name: "condtest", data: { Nome: "Fallback" } } },
      },
      { id: "notification-1", type: "notification", position: { x: 100, y: 360 }, data: { label: "No records" } },
    ];

    const edges = [
      { id: "e1", source: "trigger-1", target: "action-1" },
      { id: "e2", source: "action-1", target: "condition-1" },
      { id: "e3", source: "condition-1", target: "action-2", sourceHandle: "yes" },
      { id: "e4", source: "condition-1", target: "notification-1", sourceHandle: "no" },
    ];

    const wfId = "wf-cond-001";
    await db.insert(schema.workflows).values({
      id: wfId,
      name: "Cond WF",
      slug: "cond-wf-001",
      status: "active",
      triggerType: "manual",
      graph: JSON.stringify({ nodes, edges }),
      createdBy: TEST_USER_ID,
    });

    const execId = crypto.randomUUID();
    await db.insert(schema.workflowExecutions).values({
      id: execId,
      workflowId: wfId,
      triggeredBy: TEST_USER_ID,
    });

    await executeWorkflow(wfId, TEST_USER_ID, execId, db as any);

    const [exec] = await db.select().from(schema.workflowExecutions).where(eq(schema.workflowExecutions.id, execId));
    expect(exec.status).toBe("completed");

    // The "yes" branch (insert) should have been SKIPPED because count=0
    // So no entity records should exist
    const records = await db.select().from(schema.entityRecords).where(eq(schema.entityRecords.entityId, ENTITY_ID));
    expect(records).toHaveLength(0);
  });

  it("condition with existing records follows yes branch", async () => {
    const { executeWorkflow } = await import("./executor.js");

    // Seed a record first
    await db.insert(schema.entityRecords).values({
      id: crypto.randomUUID(),
      entityId: ENTITY_ID,
      data: '{"nome":"Existing"}',
      createdBy: TEST_USER_ID,
    });

    const nodes = [
      { id: "trigger-1", type: "trigger", position: { x: 0, y: 0 }, data: { label: "Trigger" } },
      {
        id: "action-1", type: "action", position: { x: 0, y: 120 },
        data: { label: "Query", taskType: "structured", toolName: "query_records", toolInput: { entity_id_or_name: "condtest" } },
      },
      { id: "condition-1", type: "condition", position: { x: 0, y: 240 }, data: { label: "Has records?" } },
      { id: "notification-yes", type: "notification", position: { x: -100, y: 360 }, data: { label: "Records found!" } },
      { id: "notification-no", type: "notification", position: { x: 100, y: 360 }, data: { label: "No records" } },
    ];

    const edges = [
      { id: "e1", source: "trigger-1", target: "action-1" },
      { id: "e2", source: "action-1", target: "condition-1" },
      { id: "e3", source: "condition-1", target: "notification-yes", sourceHandle: "yes" },
      { id: "e4", source: "condition-1", target: "notification-no", sourceHandle: "no" },
    ];

    const wfId = "wf-cond-002";
    await db.insert(schema.workflows).values({
      id: wfId,
      name: "Cond WF 2",
      slug: "cond-wf-002",
      status: "active",
      triggerType: "manual",
      graph: JSON.stringify({ nodes, edges }),
      createdBy: TEST_USER_ID,
    });

    const execId = crypto.randomUUID();
    await db.insert(schema.workflowExecutions).values({
      id: execId,
      workflowId: wfId,
      triggeredBy: TEST_USER_ID,
    });

    await executeWorkflow(wfId, TEST_USER_ID, execId, db as any);

    const [exec] = await db.select().from(schema.workflowExecutions).where(eq(schema.workflowExecutions.id, execId));
    expect(exec.status).toBe("completed");

    // Verify the result contains the "yes" notification
    const result = JSON.parse(exec.result!);
    expect(result["notification-yes"]).toBeDefined();
    expect(result["notification-yes"].notified).toBe(true);
  });
});

describe("multi-step workflow execution", () => {
  it("executes 2 sequential action steps passing context", async () => {
    const { executeWorkflow } = await import("./executor.js");

    const graph = generateGraphFromSteps([
      {
        type: "action",
        label: "Insert record",
        taskType: "structured",
        toolName: "insert_record",
        toolInput: { entity_id_or_name: "condtest", data: { Nome: "Step1 Product" } },
      },
      {
        type: "action",
        label: "Query records",
        taskType: "structured",
        toolName: "query_records",
        toolInput: { entity_id_or_name: "condtest" },
      },
    ]);

    const wfId = "wf-multi-001";
    await db.insert(schema.workflows).values({
      id: wfId,
      name: "Multi Step",
      slug: "multi-step-001",
      status: "active",
      triggerType: "manual",
      graph: JSON.stringify(graph),
      createdBy: TEST_USER_ID,
    });

    const execId = crypto.randomUUID();
    await db.insert(schema.workflowExecutions).values({
      id: execId,
      workflowId: wfId,
      triggeredBy: TEST_USER_ID,
    });

    await executeWorkflow(wfId, TEST_USER_ID, execId, db as any);

    const [exec] = await db.select().from(schema.workflowExecutions).where(eq(schema.workflowExecutions.id, execId));
    expect(exec.status).toBe("completed");

    // Verify both tasks were created
    const tasks = await db.select().from(schema.tasks).where(eq(schema.tasks.workflowExecutionId, execId));
    expect(tasks).toHaveLength(2);

    // Verify record exists from step 1
    const records = await db.select().from(schema.entityRecords).where(eq(schema.entityRecords.entityId, ENTITY_ID));
    expect(records).toHaveLength(1);
  });
});
