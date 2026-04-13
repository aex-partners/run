import { Worker } from "bullmq";
import { redisConnection } from "./connection.js";
import type { EmailJobData } from "./email-queue.js";

export function startEmailWorker() {
  const worker = new Worker(
    "email-send",
    async (job) => {
      const { accountId, storeSent, ...options } = job.data as EmailJobData;
      const { db } = await import("../db/index.js");
      const { getAccountSmtpConfig, sendMailWithConfig } = await import("../email/provider.js");

      // Fix #7: single DB fetch, reuse config for both send and store
      const config = await getAccountSmtpConfig(db, accountId);
      if (!config) {
        console.warn(`[email] Account ${accountId} not found, skipping`);
        return;
      }

      console.log(`[email] Sending to ${options.to.join(", ")}: ${options.subject}`);
      const result = await sendMailWithConfig(config, options);
      console.log(`[email] Sent: ${result.messageId} (accepted: ${result.accepted.length}, rejected: ${result.rejected.length})`);

      if (storeSent !== false) {
        const { storeSentEmail } = await import("../email/sync.js");
        await storeSentEmail(db, {
          accountId,
          fromName: options.fromName || config.fromName || config.from,
          fromEmail: config.from,
          to: options.to,
          cc: options.cc,
          subject: options.subject,
          bodyHtml: options.bodyHtml,
          messageId: result.messageId,
        });
      }
    },
    {
      connection: redisConnection,
      concurrency: 5,
    },
  );

  worker.on("failed", async (job, err) => {
    const { captureError } = await import("../observability.js");
    captureError(err, { kind: "email-worker-failed", jobId: job?.id });
  });

  console.log("[email] SMTP worker started");
  return worker;
}
