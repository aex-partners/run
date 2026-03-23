import { Queue } from "bullmq";
import { redisConnection } from "./connection.js";

export const flowQueue = new Queue("flow-runs", { connection: redisConnection });

export async function enqueueFlowRun(runId: string, delayMs?: number) {
  await flowQueue.add(
    "run-flow",
    { runId },
    { jobId: runId, ...(delayMs && delayMs > 0 ? { delay: delayMs } : {}) },
  );
}
