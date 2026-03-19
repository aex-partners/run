import { eq } from "drizzle-orm";
import { workflows, workflowExecutions } from "../db/schema/index.js";
import { enqueueWorkflowExecution } from "../queue/workflow-queue.js";
import { workflowQueue } from "../queue/workflow-queue.js";
import type { Database } from "../db/index.js";

// ---- Cron Triggers ----

/**
 * Register a cron trigger for a workflow as a BullMQ repeatable job.
 */
export async function registerCronTrigger(workflowId: string, cronExpression: string) {
  // Remove existing first
  await unregisterCronTrigger(workflowId);

  await workflowQueue.add(
    "cron-trigger",
    { workflowId },
    {
      repeat: { pattern: cronExpression },
      jobId: `cron-${workflowId}`,
    },
  );

  console.log(`Cron trigger registered for workflow ${workflowId}: ${cronExpression}`);
}

/**
 * Unregister a cron trigger for a workflow.
 */
export async function unregisterCronTrigger(workflowId: string) {
  const repeatable = await workflowQueue.getRepeatableJobs();
  for (const job of repeatable) {
    if (job.id === `cron-${workflowId}`) {
      await workflowQueue.removeRepeatableByKey(job.key);
      console.log(`Cron trigger unregistered for workflow ${workflowId}`);
    }
  }
}

// ---- Event Triggers ----

interface EventConfig {
  eventType?: string;
  entityId?: string;
}

// In-memory map of active event triggers
const eventTriggers = new Map<string, EventConfig>();

/**
 * Register an event trigger for a workflow.
 */
export function registerEventTrigger(workflowId: string, config: Record<string, unknown>) {
  eventTriggers.set(workflowId, {
    eventType: config.eventType as string | undefined,
    entityId: config.entityId as string | undefined,
  });
  console.log(`Event trigger registered for workflow ${workflowId}:`, config);
}

/**
 * Unregister an event trigger for a workflow.
 */
export function unregisterEventTrigger(workflowId: string) {
  eventTriggers.delete(workflowId);
}

/**
 * Check if a broadcast event matches any active event triggers.
 * Should be called from the broadcast function hook.
 */
export async function checkEventTriggers(
  eventType: string,
  eventData: Record<string, unknown>,
  db: Database,
) {
  for (const [workflowId, config] of eventTriggers) {
    if (!config.eventType || config.eventType !== eventType) continue;
    if (config.entityId && eventData.entityId !== config.entityId) continue;

    // Match found, create execution and enqueue
    const executionId = crypto.randomUUID();
    await db.insert(workflowExecutions).values({
      id: executionId,
      workflowId,
      triggeredBy: null,
    });

    await enqueueWorkflowExecution(executionId);
    console.log(`Event trigger fired for workflow ${workflowId} on ${eventType}`);
  }
}

// ---- Lifecycle ----

/**
 * Load all active triggers from DB on server startup.
 */
export async function loadActiveTriggers(db: Database) {
  const activeWorkflows = await db
    .select()
    .from(workflows)
    .where(eq(workflows.status, "active"));

  let cronCount = 0;
  let eventCount = 0;

  for (const wf of activeWorkflows) {
    const config = JSON.parse(wf.triggerConfig);

    if (wf.triggerType === "cron" && config.cronExpression) {
      await registerCronTrigger(wf.id, config.cronExpression);
      cronCount++;
    } else if (wf.triggerType === "event") {
      registerEventTrigger(wf.id, config);
      eventCount++;
    }
  }

  console.log(`Loaded ${cronCount} cron triggers and ${eventCount} event triggers`);
}
