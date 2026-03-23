/**
 * Polling scheduler for flow triggers.
 * Uses BullMQ repeatable jobs to run flows on a cron schedule.
 */

import { Queue } from "bullmq";
import { redisConnection } from "../queue/connection.js";

const QUEUE_NAME = "flow-polling";

let pollingQueue: Queue | undefined;

function getPollingQueue(): Queue {
  if (!pollingQueue) {
    pollingQueue = new Queue(QUEUE_NAME, { connection: redisConnection });
  }
  return pollingQueue;
}

/**
 * Enable a polling trigger for a flow using a cron expression.
 * Creates a BullMQ repeatable job that fires on the given schedule.
 */
export async function enablePollingTrigger(
  flowId: string,
  cronExpression: string,
): Promise<void> {
  const queue = getPollingQueue();

  await queue.add(
    "poll-flow",
    { flowId },
    {
      jobId: `poll-${flowId}`,
      repeat: {
        pattern: cronExpression,
      },
    },
  );
}

/**
 * Disable a polling trigger for a flow.
 * Removes the repeatable job from the queue.
 */
export async function disablePollingTrigger(flowId: string): Promise<void> {
  const queue = getPollingQueue();

  const repeatableJobs = await queue.getRepeatableJobs();
  const match = repeatableJobs.find((job) => job.id === `poll-${flowId}`);

  if (match) {
    await queue.removeRepeatableByKey(match.key);
  }
}

export { getPollingQueue };
