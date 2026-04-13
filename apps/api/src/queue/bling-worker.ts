import { Worker } from "bullmq";
import { redisConnection } from "./connection.js";

const SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

export function startBlingSyncWorker() {
  const worker = new Worker(
    "bling-sync",
    async (job) => {
      const { integrationId } = job.data as { integrationId: string };
      const { db } = await import("../db/index.js");
      const { syncBlingData } = await import("../bling/sync.js");
      const { enqueueBlingSync } = await import("./bling-queue.js");

      try {
        console.log(`[bling-sync] Starting sync for integration ${integrationId}`);
        const stats = await syncBlingData(db, integrationId);
        console.log("[bling-sync] Sync complete:", stats);
      } catch (error) {
        console.error(`[bling-sync] Error syncing integration ${integrationId}:`, error);
      }

      // Only re-enqueue if integration is still enabled
      const { eq } = await import("drizzle-orm");
      const { integrations } = await import("../db/schema/index.js");
      const [integration] = await db
        .select({ status: integrations.status })
        .from(integrations)
        .where(eq(integrations.id, integrationId))
        .limit(1);

      if (integration?.status === "enabled") {
        await enqueueBlingSync(integrationId, SYNC_INTERVAL_MS);
      } else {
        console.log(`[bling-sync] Integration ${integrationId} is disabled, stopping polling`);
      }
    },
    {
      connection: redisConnection,
      concurrency: 1,
    },
  );

  worker.on("failed", async (job, err) => {
    const { captureError } = await import("../observability.js");
    captureError(err, { kind: "bling-worker-failed", jobId: job?.id });
  });

  console.log("[bling-sync] Worker started");
  return worker;
}
