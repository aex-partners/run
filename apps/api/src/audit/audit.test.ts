import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { getTestDb, cleanDb, seedTestUser, closeTestDb, TEST_USER_ID } from "../test/helpers.js";
import * as schema from "../db/schema/index.js";

describe("audit trails (DB integration)", () => {
  const db = getTestDb();

  beforeAll(async () => {
    await cleanDb();
    await seedTestUser(db);
  });

  beforeEach(async () => {
    const { sql } = await import("drizzle-orm");
    await db.execute(sql.raw(`DELETE FROM "task_logs"`));
    await db.execute(sql.raw(`DELETE FROM "tasks"`));
    await db.execute(sql.raw(`DELETE FROM "workflow_executions"`));
    await db.execute(sql.raw(`DELETE FROM "workflows"`));
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it("task_logs persist with level, message, and metadata", async () => {
    const taskId = crypto.randomUUID();
    await db.insert(schema.tasks).values({
      id: taskId,
      title: "Audit task",
      input: "test",
      createdBy: TEST_USER_ID,
      type: "inference",
    });

    const logId = crypto.randomUUID();
    await db.insert(schema.taskLogs).values({
      id: logId,
      taskId,
      level: "step",
      message: "Calling insert_record",
      metadata: JSON.stringify({ toolName: "insert_record", args: { entity: "clientes" } }),
    });

    const logs = await db
      .select()
      .from(schema.taskLogs)
      .where(eq(schema.taskLogs.taskId, taskId));

    expect(logs).toHaveLength(1);
    expect(logs[0].level).toBe("step");
    expect(logs[0].message).toContain("insert_record");
    const meta = JSON.parse(logs[0].metadata!);
    expect(meta.toolName).toBe("insert_record");
  });

  it("task_logs cascade on task delete", async () => {
    const taskId = crypto.randomUUID();
    await db.insert(schema.tasks).values({
      id: taskId,
      title: "Cascade task",
      input: "test",
      createdBy: TEST_USER_ID,
      type: "inference",
    });

    await db.insert(schema.taskLogs).values({
      id: crypto.randomUUID(),
      taskId,
      level: "info",
      message: "Test log",
    });

    await db.delete(schema.tasks).where(eq(schema.tasks.id, taskId));

    const logs = await db
      .select()
      .from(schema.taskLogs)
      .where(eq(schema.taskLogs.taskId, taskId));
    expect(logs).toHaveLength(0);
  });

  it("workflow_executions track triggeredBy and status transitions", async () => {
    const wfId = crypto.randomUUID();
    await db.insert(schema.workflows).values({
      id: wfId,
      name: "Audit WF",
      slug: "audit-wf",
      status: "active",
      triggerType: "manual",
      graph: '{"nodes":[],"edges":[]}',
      createdBy: TEST_USER_ID,
    });

    const execId = crypto.randomUUID();
    await db.insert(schema.workflowExecutions).values({
      id: execId,
      workflowId: wfId,
      triggeredBy: TEST_USER_ID,
    });

    // Simulate status transitions
    await db
      .update(schema.workflowExecutions)
      .set({ status: "running", startedAt: new Date() })
      .where(eq(schema.workflowExecutions.id, execId));

    await db
      .update(schema.workflowExecutions)
      .set({ status: "completed", result: '{"ok":true}', completedAt: new Date() })
      .where(eq(schema.workflowExecutions.id, execId));

    const [exec] = await db
      .select()
      .from(schema.workflowExecutions)
      .where(eq(schema.workflowExecutions.id, execId));

    expect(exec.status).toBe("completed");
    expect(exec.triggeredBy).toBe(TEST_USER_ID);
    expect(exec.startedAt).not.toBeNull();
    expect(exec.completedAt).not.toBeNull();
    expect(exec.result).toContain("ok");
  });

  it("workflow_executions cascade on workflow delete", async () => {
    const wfId = crypto.randomUUID();
    await db.insert(schema.workflows).values({
      id: wfId,
      name: "Cascade WF",
      slug: "cascade-wf",
      graph: '{"nodes":[],"edges":[]}',
      createdBy: TEST_USER_ID,
    });

    await db.insert(schema.workflowExecutions).values({
      id: crypto.randomUUID(),
      workflowId: wfId,
    });

    await db.delete(schema.workflows).where(eq(schema.workflows.id, wfId));

    const execs = await db
      .select()
      .from(schema.workflowExecutions)
      .where(eq(schema.workflowExecutions.workflowId, wfId));
    expect(execs).toHaveLength(0);
  });

  it("tasks track status transitions with timestamps", async () => {
    const taskId = crypto.randomUUID();
    await db.insert(schema.tasks).values({
      id: taskId,
      title: "Status task",
      input: "test",
      createdBy: TEST_USER_ID,
      type: "inference",
    });

    // pending -> running
    const startedAt = new Date();
    await db
      .update(schema.tasks)
      .set({ status: "running", startedAt })
      .where(eq(schema.tasks.id, taskId));

    // running -> completed
    const completedAt = new Date();
    await db
      .update(schema.tasks)
      .set({ status: "completed", result: "Done", completedAt, progress: 100 })
      .where(eq(schema.tasks.id, taskId));

    const [task] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, taskId));
    expect(task.status).toBe("completed");
    expect(task.startedAt).not.toBeNull();
    expect(task.completedAt).not.toBeNull();
    expect(task.progress).toBe(100);
    expect(task.result).toBe("Done");
  });

  it("tasks record errors on failure", async () => {
    const taskId = crypto.randomUUID();
    await db.insert(schema.tasks).values({
      id: taskId,
      title: "Failing task",
      input: "test",
      createdBy: TEST_USER_ID,
      type: "inference",
      status: "running",
      startedAt: new Date(),
    });

    await db
      .update(schema.tasks)
      .set({ status: "failed", error: "Connection refused", completedAt: new Date() })
      .where(eq(schema.tasks.id, taskId));

    const [task] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, taskId));
    expect(task.status).toBe("failed");
    expect(task.error).toBe("Connection refused");
  });

  it("entity createdBy links to user", async () => {
    const entityId = crypto.randomUUID();
    await db.insert(schema.entities).values({
      id: entityId,
      name: "Audit Entity",
      slug: "audit-entity",
      fields: "[]",
      createdBy: TEST_USER_ID,
    });

    const [entity] = await db
      .select()
      .from(schema.entities)
      .where(eq(schema.entities.id, entityId));
    expect(entity.createdBy).toBe(TEST_USER_ID);
    expect(entity.createdAt).toBeInstanceOf(Date);

    // Cleanup
    await db.delete(schema.entities).where(eq(schema.entities.id, entityId));
  });

  it("entityRecord createdBy tracks who inserted", async () => {
    const entityId = crypto.randomUUID();
    await db.insert(schema.entities).values({
      id: entityId,
      name: "Record Audit",
      slug: "record-audit",
      fields: "[]",
      createdBy: TEST_USER_ID,
    });

    const recordId = crypto.randomUUID();
    await db.insert(schema.entityRecords).values({
      id: recordId,
      entityId,
      data: '{"nome":"Test"}',
      createdBy: TEST_USER_ID,
    });

    const [record] = await db
      .select()
      .from(schema.entityRecords)
      .where(eq(schema.entityRecords.id, recordId));
    expect(record.createdBy).toBe(TEST_USER_ID);
    expect(record.createdAt).toBeInstanceOf(Date);

    // Cleanup
    await db.delete(schema.entityRecords).where(eq(schema.entityRecords.id, recordId));
    await db.delete(schema.entities).where(eq(schema.entities.id, entityId));
  });
});
