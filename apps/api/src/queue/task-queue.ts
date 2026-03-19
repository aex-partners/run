import { Queue } from "bullmq";
import { redisConnection } from "./connection.js";

export const taskQueue = new Queue("tasks", { connection: redisConnection });

export async function enqueueTask(taskId: string, delayMs?: number) {
  await taskQueue.add(
    "run-task",
    { taskId },
    { jobId: taskId, ...(delayMs && delayMs > 0 ? { delay: delayMs } : {}) },
  );
}
