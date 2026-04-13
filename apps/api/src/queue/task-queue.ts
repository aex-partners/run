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

/** Remove a still-pending task job from BullMQ. Returns true when the job was found and removed. */
export async function cancelTaskJob(taskId: string): Promise<boolean> {
  const job = await taskQueue.getJob(taskId);
  if (!job) return false;
  await job.remove();
  return true;
}
