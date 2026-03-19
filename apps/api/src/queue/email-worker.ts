import { Worker } from "bullmq";
import { redisConnection } from "./connection.js";

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function startEmailSyncWorker() {
  const worker = new Worker(
    "email-sync",
    async (job) => {
      const { accountId } = job.data as { accountId: string };
      const { db } = await import("../db/index.js");
      const { syncEmailAccount } = await import("../email/sync.js");
      const { enqueueEmailSync } = await import("./email-queue.js");

      try {
        console.log(`[email-sync] Syncing account ${accountId}`);
        const result = await syncEmailAccount(db, accountId);
        console.log(`[email-sync] Done: ${result.newCount} new emails`);
      } catch (error) {
        console.error(`[email-sync] Error syncing account ${accountId}:`, error);
      }

      // Re-enqueue for continuous polling
      await enqueueEmailSync(accountId, SYNC_INTERVAL_MS);
    },
    {
      connection: redisConnection,
      concurrency: 2,
    },
  );

  worker.on("failed", (job, err) => {
    console.error(`[email-sync] Job ${job?.id} failed:`, err.message);
  });

  console.log("[email-sync] Worker started");
  return worker;
}
