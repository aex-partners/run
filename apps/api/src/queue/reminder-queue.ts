import { Queue } from "bullmq";
import { redisConnection } from "./connection.js";

export interface ReminderJobData {
  reminderId: string;
}

export const QUEUE_NAME = "reminders";

export const reminderQueue = new Queue(QUEUE_NAME, { connection: redisConnection });

/** Enqueue a reminder to fire at `scheduledFor` (BullMQ delay = difference from now, min 0). */
export async function enqueueReminder(reminderId: string, scheduledFor: Date): Promise<string> {
  const delay = Math.max(0, scheduledFor.getTime() - Date.now());
  const job = await reminderQueue.add(
    "fire",
    { reminderId } satisfies ReminderJobData,
    {
      jobId: `reminder-${reminderId}`,
      delay,
      attempts: 5,
      backoff: { type: "exponential", delay: 10_000 },
      removeOnComplete: true,
      removeOnFail: 100,
    },
  );
  return job.id ?? `reminder-${reminderId}`;
}

export async function cancelReminderJob(reminderId: string): Promise<boolean> {
  const jobId = `reminder-${reminderId}`;
  const job = await reminderQueue.getJob(jobId);
  if (!job) return false;
  await job.remove();
  return true;
}
