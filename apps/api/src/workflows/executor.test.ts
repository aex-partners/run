import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getTestDb, cleanDb, seedTestUser, closeTestDb, TEST_USER_ID } from "../test/helpers.js";
import * as schema from "../db/schema/index.js";
import { serializeFields, type EntityField } from "../db/entity-fields.js";
import { generateGraphFromSteps } from "./executor.js";

// Mock WS
vi.mock("../ws/index.js", () => ({
  sendToConversation: vi.fn(),
  sendToUser: vi.fn(),
  broadcast: vi.fn(),
  registerWebSocket: vi.fn(),
}));

// Mock LLM
vi.mock("../ai/client.js", async () => {
  const { createTestModel } = await import("../test/mock-model.js");
  const m = createTestModel({ text: "Workflow step done." });
  return {
    model: m,
    nanoModel: m,
    openaiProvider: { chat: () => m },
    getModel: () => m,
  };
});

const ENTITY_ID = "ent-wf-test-001";
const WORKFLOW_ID = "wf-test-001";

const productFields: EntityField[] = [
  { id: "f1", name: "Nome", slug: "nome", type: "text", required: true },
];

describe("generateGraphFromSteps", () => {
  it("creates trigger + step nodes with edges", () => {
    const graph = generateGraphFromSteps([
      { type: "action", label: "Step 1" },
      { type: "notification", label: "Notify" },
    ]);

    expect(graph.nodes).toHaveLength(3); // trigger + 2 steps
    expect(graph.nodes[0].type).toBe("trigger");
    expect(graph.nodes[1].type).toBe("action");
    expect(graph.nodes[2].type).toBe("notification");
    expect(graph.edges).toHaveLength(2); // trigger→action, action→notification
  });

  it("preserves step config and taskType", () => {
    const graph = generateGraphFromSteps([
      {
        type: "action",
        label: "Insert record",
        taskType: "structured",
        toolName: "insert_record",
        toolInput: { entity_id_or_name: "clientes", data: { Nome: "Test" } },
      },
    ]);

    expect(graph.nodes[1].data.taskType).toBe("structured");
    expect(graph.nodes[1].data.toolName).toBe("insert_record");
    expect(graph.nodes[1].data.toolInput).toBeDefined();
  });

  it("generates sequential edges in order", () => {
    const graph = generateGraphFromSteps([
      { type: "action", label: "A" },
      { type: "condition", label: "B" },
      { type: "action", label: "C" },
    ]);

    expect(graph.edges[0].source).toBe("trigger-1");
    expect(graph.edges[0].target).toBe("action-1");
    expect(graph.edges[1].source).toBe("action-1");
    expect(graph.edges[1].target).toBe("condition-2");
    expect(graph.edges[2].source).toBe("condition-2");
    expect(graph.edges[2].target).toBe("action-3");
  });
});

describe("executeWorkflow (integration)", () => {
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

  it("executes a single-step structured workflow", async () => {
    const { executeWorkflow } = await import("./executor.js");

    const graph = generateGraphFromSteps([
      {
        type: "action",
        label: "Insert product",
        taskType: "structured",
        toolName: "insert_record",
        toolInput: { entity_id_or_name: "produtos", data: { Nome: "Cuia Artesanal" } },
      },
    ]);

    await db.insert(schema.workflows).values({
      id: WORKFLOW_ID,
      name: "Test Workflow",
      slug: "test-workflow",
      status: "active",
      triggerType: "manual",
      graph: JSON.stringify(graph),
      createdBy: TEST_USER_ID,
    });

    const execId = crypto.randomUUID();
    await db.insert(schema.workflowExecutions).values({
      id: execId,
      workflowId: WORKFLOW_ID,
      triggeredBy: TEST_USER_ID,
    });

    await executeWorkflow(WORKFLOW_ID, TEST_USER_ID, execId, db as any);

    // Verify execution status
    const [exec] = await db
      .select()
      .from(schema.workflowExecutions)
      .where(eq(schema.workflowExecutions.id, execId));
    expect(exec.status).toBe("completed");
    expect(exec.result).toBeDefined();

    // Verify record was inserted
    const records = await db
      .select()
      .from(schema.entityRecords)
      .where(eq(schema.entityRecords.entityId, ENTITY_ID));
    expect(records).toHaveLength(1);
  });

  it("handles empty graph (trigger-only) without errors", async () => {
    const { executeWorkflow } = await import("./executor.js");

    const wfId = "wf-empty-" + crypto.randomUUID().slice(0, 8);
    const graph = { nodes: [{ id: "trigger-1", type: "trigger", position: { x: 0, y: 0 }, data: { label: "Trigger" } }], edges: [] };

    await db.insert(schema.workflows).values({
      id: wfId,
      name: "Empty WF",
      slug: "empty-wf-" + crypto.randomUUID().slice(0, 8),
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

    const [exec] = await db
      .select()
      .from(schema.workflowExecutions)
      .where(eq(schema.workflowExecutions.id, execId));
    expect(exec.status).toBe("completed");
  });

  it("tracks task records per workflow execution", async () => {
    const { executeWorkflow } = await import("./executor.js");

    const graph = generateGraphFromSteps([
      {
        type: "action",
        label: "Query products",
        taskType: "structured",
        toolName: "query_records",
        toolInput: { entity_id_or_name: "produtos" },
      },
    ]);

    const wfId = "wf-task-track";
    await db.insert(schema.workflows).values({
      id: wfId,
      name: "Track Tasks",
      slug: "track-tasks",
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

    // Verify a task was created linked to this execution
    const taskRows = await db
      .select()
      .from(schema.tasks)
      .where(eq(schema.tasks.workflowExecutionId, execId));
    expect(taskRows).toHaveLength(1);
    expect(taskRows[0].title).toContain("Query products");
  });
});
