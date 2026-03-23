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

vi.mock("../workflows/executor.js", () => ({
  generateGraphFromSteps: vi.fn((steps: any[]) => ({
    nodes: steps.map((s: any, i: number) => ({ id: `node-${i}`, type: s.type, data: { label: s.label } })),
    edges: steps.slice(1).map((_: any, i: number) => ({ id: `edge-${i}`, source: `node-${i}`, target: `node-${i + 1}` })),
  })),
}));

vi.mock("../queue/workflow-queue.js", () => ({
  enqueueWorkflowExecution: vi.fn(),
}));

vi.mock("../workflows/triggers.js", () => ({
  registerCronTrigger: vi.fn(),
  unregisterCronTrigger: vi.fn(),
  registerEventTrigger: vi.fn(),
  unregisterEventTrigger: vi.fn(),
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

// ---- Workflow tools ----

describe("tools: create_workflow", () => {
  beforeEach(async () => {
    const { sql } = await import("drizzle-orm");
    await db.execute(sql.raw(`DELETE FROM "workflow_executions"`));
    await db.execute(sql.raw(`DELETE FROM "workflows"`));
  });

  it("creates a manual workflow with 2 action steps", async () => {
    const result = await tools.create_workflow.execute(
      {
        name: "Daily Report",
        trigger_type: "manual",
        steps: [
          { type: "action", label: "Fetch sales data" },
          { type: "action", label: "Generate PDF report" },
        ],
      },
      { toolCallId: "wf1" },
    );

    expect(result.id).toBeDefined();
    expect(result.name).toBe("Daily Report");
    expect(result.slug).toBe("daily_report");
    expect(result.status).toBe("paused");
    expect(result.triggerType).toBe("manual");
    expect(result.steps).toBe(2);
    expect(result.nodes).toBe(2);

    const [row] = await db.select().from(schema.workflows).where(eq(schema.workflows.id, result.id));
    expect(row).toBeDefined();
    expect(row.name).toBe("Daily Report");

    const graph = JSON.parse(row.graph);
    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(1);
    expect(graph.nodes[0].data.label).toBe("Fetch sales data");
    expect(graph.nodes[1].data.label).toBe("Generate PDF report");
  });

  it("creates a cron workflow with triggerType and triggerConfig", async () => {
    const result = await tools.create_workflow.execute(
      {
        name: "Nightly Sync",
        trigger_type: "cron",
        trigger_config: { cronExpression: "0 3 * * *" },
        steps: [{ type: "action", label: "Sync inventory" }],
      },
      { toolCallId: "wf2" },
    );

    expect(result.triggerType).toBe("cron");

    const [row] = await db.select().from(schema.workflows).where(eq(schema.workflows.id, result.id));
    expect(row.triggerType).toBe("cron");
    const config = JSON.parse(row.triggerConfig);
    expect(config.cronExpression).toBe("0 3 * * *");
  });
});

describe("tools: list_workflows", () => {
  beforeEach(async () => {
    const { sql } = await import("drizzle-orm");
    await db.execute(sql.raw(`DELETE FROM "workflow_executions"`));
    await db.execute(sql.raw(`DELETE FROM "workflows"`));

    await db.insert(schema.workflows).values([
      {
        id: "wf-active-1",
        name: "Active Flow",
        slug: "active-flow",
        status: "active",
        triggerType: "manual",
        triggerConfig: "{}",
        graph: '{"nodes":[],"edges":[]}',
        createdBy: TEST_USER_ID,
      },
      {
        id: "wf-paused-1",
        name: "Paused Flow",
        slug: "paused-flow",
        status: "paused",
        triggerType: "cron",
        triggerConfig: '{"cronExpression":"0 9 * * *"}',
        graph: '{"nodes":[],"edges":[]}',
        createdBy: TEST_USER_ID,
      },
    ]);
  });

  it("lists all workflows", async () => {
    const result = await tools.list_workflows.execute({}, { toolCallId: "wf3" });
    expect(result.workflows).toHaveLength(2);

    const names = result.workflows.map((w: any) => w.name);
    expect(names).toContain("Active Flow");
    expect(names).toContain("Paused Flow");
  });

  it("filters by status", async () => {
    const result = await tools.list_workflows.execute({ status: "active" }, { toolCallId: "wf4" });
    expect(result.workflows).toHaveLength(1);
    expect(result.workflows[0].name).toBe("Active Flow");
  });
});

describe("tools: update_workflow", () => {
  beforeEach(async () => {
    const { sql } = await import("drizzle-orm");
    await db.execute(sql.raw(`DELETE FROM "workflow_executions"`));
    await db.execute(sql.raw(`DELETE FROM "workflows"`));

    await db.insert(schema.workflows).values({
      id: "wf-update-1",
      name: "Old Name",
      slug: "old-name",
      status: "paused",
      triggerType: "manual",
      triggerConfig: "{}",
      graph: '{"nodes":[],"edges":[]}',
      createdBy: TEST_USER_ID,
    });
  });

  it("updates name and status", async () => {
    const result = await tools.update_workflow.execute(
      { workflow_id: "wf-update-1", name: "New Name", status: "active" },
      { toolCallId: "wf5" },
    );

    expect(result.updated).toBe(true);
    expect(result.id).toBe("wf-update-1");

    const [row] = await db.select().from(schema.workflows).where(eq(schema.workflows.id, "wf-update-1"));
    expect(row.name).toBe("New Name");
    expect(row.slug).toBe("new_name");
    expect(row.status).toBe("active");
  });

  it("updates with new steps and regenerates graph", async () => {
    const result = await tools.update_workflow.execute(
      {
        workflow_id: "wf-update-1",
        steps: [
          { type: "action", label: "Step A" },
          { type: "condition", label: "Check stock" },
          { type: "notification", label: "Notify team" },
        ],
      },
      { toolCallId: "wf6" },
    );

    expect(result.updated).toBe(true);

    const [row] = await db.select().from(schema.workflows).where(eq(schema.workflows.id, "wf-update-1"));
    const graph = JSON.parse(row.graph);
    expect(graph.nodes).toHaveLength(3);
    expect(graph.edges).toHaveLength(2);
    expect(graph.nodes[0].data.label).toBe("Step A");
    expect(graph.nodes[1].data.label).toBe("Check stock");
    expect(graph.nodes[2].data.label).toBe("Notify team");
  });

  it("returns error for non-existent workflow", async () => {
    const result = await tools.update_workflow.execute(
      { workflow_id: "non-existent-id", name: "Nope" },
      { toolCallId: "wf7" },
    );

    expect(result.error).toBe("Workflow not found");
  });
});

describe("tools: execute_workflow", () => {
  beforeEach(async () => {
    const { sql } = await import("drizzle-orm");
    await db.execute(sql.raw(`DELETE FROM "workflow_executions"`));
    await db.execute(sql.raw(`DELETE FROM "workflows"`));

    await db.insert(schema.workflows).values({
      id: "wf-exec-1",
      name: "Exec Flow",
      slug: "exec-flow",
      status: "active",
      triggerType: "manual",
      triggerConfig: "{}",
      graph: '{"nodes":[],"edges":[]}',
      createdBy: TEST_USER_ID,
    });
  });

  it("creates an execution record in workflowExecutions", async () => {
    const result = await tools.execute_workflow.execute(
      { workflow_id: "wf-exec-1" },
      { toolCallId: "wf8" },
    );

    expect(result.executionId).toBeDefined();
    expect(result.workflowId).toBe("wf-exec-1");
    expect(result.status).toBe("pending");

    const [execution] = await db
      .select()
      .from(schema.workflowExecutions)
      .where(eq(schema.workflowExecutions.id, result.executionId));
    expect(execution).toBeDefined();
    expect(execution.workflowId).toBe("wf-exec-1");
    expect(execution.status).toBe("pending");
    expect(execution.triggeredBy).toBe(TEST_USER_ID);
  });

  it("returns error for non-existent workflow", async () => {
    const result = await tools.execute_workflow.execute(
      { workflow_id: "non-existent-id" },
      { toolCallId: "wf9" },
    );

    expect(result.error).toBe("Workflow not found");
  });
});

// ---- Plugin tools ----

describe("tools: list_plugins", () => {
  beforeEach(async () => {
    const { sql } = await import("drizzle-orm");
    await db.execute(sql.raw(`DELETE FROM "plugins"`));

    await db.insert(schema.plugins).values([
      {
        id: "p1",
        name: "Slack",
        description: "Slack integration",
        version: "1.0",
        category: "COMMUNICATION",
        source: "registry",
        status: "available",
        config: "{}",
      },
      {
        id: "p2",
        name: "Google Sheets",
        description: "Sheets integration",
        version: "1.0",
        category: "PRODUCTIVITY",
        source: "registry",
        status: "installed",
        config: "{}",
      },
    ]);
  });

  it("lists all plugins", async () => {
    const result = await tools.list_plugins.execute({}, { toolCallId: "pl1" });

    expect(result.total).toBe(2);
    expect(result.plugins).toHaveLength(2);

    const names = result.plugins.map((p: any) => p.name);
    expect(names).toContain("Slack");
    expect(names).toContain("Google Sheets");
  });

  it("filters by category", async () => {
    const result = await tools.list_plugins.execute(
      { category: "COMMUNICATION" },
      { toolCallId: "pl2" },
    );

    expect(result.total).toBe(1);
    expect(result.plugins[0].name).toBe("Slack");
    expect(result.plugins[0].category).toBe("COMMUNICATION");
  });

  it("filters by status", async () => {
    const result = await tools.list_plugins.execute(
      { status: "installed" },
      { toolCallId: "pl3" },
    );

    expect(result.total).toBe(1);
    expect(result.plugins[0].name).toBe("Google Sheets");
    expect(result.plugins[0].status).toBe("installed");
  });

  it("searches by query", async () => {
    const result = await tools.list_plugins.execute(
      { query: "slack" },
      { toolCallId: "pl4" },
    );

    expect(result.total).toBe(1);
    expect(result.plugins[0].name).toBe("Slack");
  });
});
