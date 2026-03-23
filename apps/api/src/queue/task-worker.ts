import { Worker } from "bullmq";
import { eq } from "drizzle-orm";
import { redisConnection } from "./connection.js";
import { runTask, TaskCancelledException } from "./task-runner.js";
import { tasks, messages, conversationMembers } from "../db/schema/index.js";
import { broadcast, sendToConversation } from "../ws/index.js";
import { db } from "../db/index.js";
import { DEFAULT_AGENT_ID, DEFAULT_AGENT_NAME } from "@aex/shared";

async function reportToChat(conversationId: string | null, content: string, agentId = DEFAULT_AGENT_ID) {
  if (!conversationId) return;
  const msgId = crypto.randomUUID();
  await db.insert(messages).values({
    id: msgId,
    conversationId,
    authorId: null,
    agentId,
    content,
    role: "ai",
  });
  const members = await db
    .select({ userId: conversationMembers.userId })
    .from(conversationMembers)
    .where(eq(conversationMembers.conversationId, conversationId));
  const memberIds = members.map((m) => m.userId);
  sendToConversation(memberIds, {
    type: "new_message",
    message: {
      id: msgId,
      conversationId,
      authorId: null,
      agentId,
      authorName: DEFAULT_AGENT_NAME,
      content,
      role: "ai",
      createdAt: new Date().toISOString(),
    },
  });
}

export function startTaskWorker() {
  const worker = new Worker(
    "tasks",
    async (job) => {
      const { taskId } = job.data as { taskId: string };

      // Load task from DB
      const [task] = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, taskId))
        .limit(1);

      if (!task) {
        console.error(`Task ${taskId} not found`);
        return;
      }

      if (task.status !== "pending") {
        console.log(`Task ${taskId} is ${task.status}, skipping`);
        return;
      }

      // Mark as running
      const startedAt = new Date();
      await db
        .update(tasks)
        .set({ status: "running", startedAt })
        .where(eq(tasks.id, taskId));

      broadcast({
        type: "task_updated",
        task: { id: taskId, status: "running", progress: 0, title: task.title },
      });

      try {
        const result = await runTask(
          {
            id: task.id,
            title: task.title,
            input: task.input,
            conversationId: task.conversationId,
            createdBy: task.createdBy,
            type: task.type,
            agentId: task.agentId,
            toolName: task.toolName,
            structuredInput: task.structuredInput,
            outputSchema: task.outputSchema,
            createdAt: task.createdAt,
          },
          db,
        );

        const completedAt = new Date();
        await db
          .update(tasks)
          .set({ status: "completed", result, completedAt, progress: 100 })
          .where(eq(tasks.id, taskId));

        broadcast({
          type: "task_updated",
          task: { id: taskId, status: "completed", progress: 100, title: task.title },
        });

        const summary = result.length > 500 ? result.slice(0, 500) + "..." : result;
        await reportToChat(task.conversationId, summary);
      } catch (err) {
        const completedAt = new Date();
        const isCancelled = err instanceof TaskCancelledException;
        const status = isCancelled ? "cancelled" : "failed";
        const error = err instanceof Error ? err.message : String(err);

        await db
          .update(tasks)
          .set({ status, error: isCancelled ? null : error, completedAt })
          .where(eq(tasks.id, taskId));

        broadcast({
          type: "task_updated",
          task: { id: taskId, status, progress: task.progress, title: task.title },
        });

        if (!isCancelled) {
          console.error(`Task ${taskId} failed:`, err);
          await reportToChat(
            task.conversationId,
            `The task "${task.title}" failed. Please try again or contact support.`,
          );
        }
      }
    },
    {
      connection: redisConnection,
      concurrency: 3,
    },
  );

  worker.on("failed", (job, err) => {
    console.error(`Job ${job?.id} failed:`, err.message);
  });

  console.log("Task worker started");
  return worker;
}
