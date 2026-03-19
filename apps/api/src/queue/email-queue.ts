import { Queue } from "bullmq";
import { redisConnection } from "./connection.js";

export const emailSyncQueue = new Queue("email-sync", { connection: redisConnection });

export async function enqueueEmailSync(accountId: string, delayMs?: number) {
  await emailSyncQueue.add(
    "sync-email",
    { accountId },
    {
      jobId: `email-sync-${accountId}`,
      ...(delayMs && delayMs > 0 ? { delay: delayMs } : {}),
      removeOnComplete: true,
      removeOnFail: 5,
    },
  );
}
