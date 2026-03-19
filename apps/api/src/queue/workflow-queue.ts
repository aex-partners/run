import { Queue } from "bullmq";
import { redisConnection } from "./connection.js";

export const workflowQueue = new Queue("workflow-executions", { connection: redisConnection });

export async function enqueueWorkflowExecution(executionId: string, delayMs?: number) {
  await workflowQueue.add(
    "run-workflow",
    { executionId },
    { jobId: executionId, ...(delayMs && delayMs > 0 ? { delay: delayMs } : {}) },
  );
}
