/**
 * Trigger lifecycle management.
 * Called when a flow status changes to enabled/disabled.
 * Reads the trigger from the published flow version and registers/unregisters
 * the appropriate webhook or polling trigger.
 */

import { eq } from "drizzle-orm";
import type { Database } from "../db/index.js";
import { flows, flowVersions } from "../db/schema/index.js";
import { TriggerType } from "./types.js";
import type { FlowTrigger } from "./types.js";
import { enablePollingTrigger, disablePollingTrigger } from "./polling-scheduler.js";

/**
 * Enable the trigger for a flow.
 * Reads the published version, determines trigger type, and registers it.
 */
export async function enableTrigger(
  flowId: string,
  db: Database,
): Promise<void> {
  const [flow] = await db
    .select()
    .from(flows)
    .where(eq(flows.id, flowId))
    .limit(1);

  if (!flow || !flow.publishedVersionId) {
    return;
  }

  const [version] = await db
    .select()
    .from(flowVersions)
    .where(eq(flowVersions.id, flow.publishedVersionId))
    .limit(1);

  if (!version) {
    return;
  }

  const trigger = JSON.parse(version.trigger) as FlowTrigger;

  switch (trigger.type) {
    case TriggerType.WEBHOOK:
      // Webhook triggers are passive; they are handled by the incoming HTTP route.
      // No registration step needed beyond having the flow enabled.
      break;

    case TriggerType.SCHEDULE: {
      const cronExpression = trigger.settings.input?.["cronExpression"] as string | undefined;
      if (cronExpression) {
        await enablePollingTrigger(flowId, cronExpression);
      }
      break;
    }

    default:
      // EMPTY or PIECE triggers have no automatic scheduling
      break;
  }
}

/**
 * Disable the trigger for a flow.
 * Unregisters any active webhook or polling trigger.
 */
export async function disableTrigger(
  flowId: string,
  db: Database,
): Promise<void> {
  const [flow] = await db
    .select()
    .from(flows)
    .where(eq(flows.id, flowId))
    .limit(1);

  if (!flow || !flow.publishedVersionId) {
    // Even without a published version, attempt cleanup
    await disablePollingTrigger(flowId);
    return;
  }

  const [version] = await db
    .select()
    .from(flowVersions)
    .where(eq(flowVersions.id, flow.publishedVersionId))
    .limit(1);

  if (!version) {
    await disablePollingTrigger(flowId);
    return;
  }

  const trigger = JSON.parse(version.trigger) as FlowTrigger;

  switch (trigger.type) {
    case TriggerType.WEBHOOK:
      // Nothing to unregister; the HTTP route checks flow.status
      break;

    case TriggerType.SCHEDULE:
      await disablePollingTrigger(flowId);
      break;

    default:
      break;
  }
}
