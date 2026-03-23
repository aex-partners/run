import { Queue } from "bullmq";
import { redisConnection } from "./connection.js";

export const blingSyncQueue = new Queue("bling-sync", { connection: redisConnection });

export async function enqueueBlingSync(integrationId: string, delayMs?: number) {
  await blingSyncQueue.add(
    "sync-bling",
    { integrationId },
    {
      jobId: `bling-sync-${integrationId}`,
      ...(delayMs && delayMs > 0 ? { delay: delayMs } : {}),
      removeOnComplete: true,
      removeOnFail: 5,
    },
  );
}
