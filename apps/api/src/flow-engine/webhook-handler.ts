/**
 * Webhook handler for flow triggers.
 * Receives external webhook payloads, creates a flow run, and enqueues it.
 */

import { eq } from "drizzle-orm";
import type { Database } from "../db/index.js";
import { flows, flowVersions, flowRuns } from "../db/schema/index.js";
import { enqueueFlowRun } from "../queue/flow-queue.js";
import type { FlowTrigger } from "./types.js";
import { TriggerType } from "./types.js";

export interface WebhookPayload {
  body: unknown;
  headers: Record<string, string | string[] | undefined>;
  queryParams: Record<string, string | string[] | undefined>;
}

export async function handleWebhook(
  flowId: string,
  payload: WebhookPayload,
  db: Database,
): Promise<{ runId: string } | { error: string; status: number }> {
  // Find the flow and verify it is enabled
  const [flow] = await db
    .select()
    .from(flows)
    .where(eq(flows.id, flowId))
    .limit(1);

  if (!flow) {
    return { error: "Flow not found", status: 404 };
  }

  if (flow.status !== "enabled") {
    return { error: "Flow is not enabled", status: 400 };
  }

  if (!flow.publishedVersionId) {
    return { error: "Flow has no published version", status: 400 };
  }

  // Load published version and verify it has a webhook trigger
  const [version] = await db
    .select()
    .from(flowVersions)
    .where(eq(flowVersions.id, flow.publishedVersionId))
    .limit(1);

  if (!version) {
    return { error: "Published version not found", status: 404 };
  }

  const trigger = JSON.parse(version.trigger) as FlowTrigger;
  if (trigger.type !== TriggerType.WEBHOOK) {
    return { error: "Flow trigger is not a webhook", status: 400 };
  }

  // Create a flow run
  const runId = crypto.randomUUID();
  const now = new Date();

  await db.insert(flowRuns).values({
    id: runId,
    flowId,
    flowVersionId: flow.publishedVersionId,
    status: "running",
    triggeredBy: "webhook",
    triggerPayload: JSON.stringify(payload),
    createdAt: now,
    startedAt: now,
  });

  await enqueueFlowRun(runId);

  return { runId };
}
