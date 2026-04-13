import { Worker } from "bullmq";
import { eq } from "drizzle-orm";
import { redisConnection } from "./connection.js";
import type { ReminderJobData } from "./reminder-queue.js";
import { QUEUE_NAME } from "./reminder-queue.js";

export function startReminderWorker() {
  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { reminderId } = job.data as ReminderJobData;
      const { db } = await import("../db/index.js");
      const { reminders, messages, conversationMembers } = await import("../db/schema/index.js");
      const { sendToConversation, sendToUser } = await import("../ws/index.js");

      const [reminder] = await db.select().from(reminders).where(eq(reminders.id, reminderId)).limit(1);
      if (!reminder) {
        console.warn(`[reminders] ${reminderId} not found, skipping`);
        return;
      }
      if (reminder.status !== "scheduled") {
        console.log(`[reminders] ${reminderId} already ${reminder.status}, skipping`);
        return;
      }

      // Persist the user-visible side-effects FIRST so a crash between steps
      // doesn't leave the reminder in `fired` state without the user ever
      // seeing a message. BullMQ will retry the job and the early-skip above
      // only triggers after status is flipped at the very end.
      const firedAt = new Date();
      const content = `Reminder: ${reminder.message}`;

      if (reminder.conversationId) {
        const msgId = crypto.randomUUID();
        await db.insert(messages).values({
          id: msgId,
          conversationId: reminder.conversationId,
          authorId: null,
          content,
          role: "system",
        });

        const memberRows = await db
          .select({ userId: conversationMembers.userId })
          .from(conversationMembers)
          .where(eq(conversationMembers.conversationId, reminder.conversationId));
        const memberIds = memberRows.map((m) => m.userId);

        sendToConversation(memberIds, {
          type: "new_message",
          message: {
            id: msgId,
            conversationId: reminder.conversationId,
            authorId: null,
            authorName: "Reminder",
            content,
            role: "system",
            createdAt: firedAt.toISOString(),
          },
        });
      } else {
        sendToUser(reminder.userId, {
          type: "reminder",
          reminderId: reminder.id,
          message: reminder.message,
          firedAt: firedAt.toISOString(),
        });
      }

      await db
        .update(reminders)
        .set({ status: "fired", firedAt, updatedAt: firedAt })
        .where(eq(reminders.id, reminderId));

      console.log(`[reminders] fired ${reminderId} for user ${reminder.userId}`);
    },
    {
      connection: redisConnection,
      concurrency: 5,
    },
  );

  worker.on("failed", (job, err) => {
    console.error(`[reminders] Job ${job?.id} failed:`, err.message);
  });

  console.log("[reminders] worker started");
  return worker;
}
