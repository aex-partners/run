import { Queue } from "bullmq";
import { redisConnection } from "./connection.js";
import type { SendMailOptions } from "../email/provider.js";

export interface EmailJobData extends SendMailOptions {
  accountId: string;
  storeSent?: boolean;
}

export const emailQueue = new Queue("email-send", { connection: redisConnection });

/** Enqueue an email to be sent via SMTP in the background. */
export async function enqueueEmail(options: EmailJobData) {
  await emailQueue.add(
    "send-email",
    options,
    {
      attempts: 3,
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: true,
      removeOnFail: 10,
    },
  );
}
