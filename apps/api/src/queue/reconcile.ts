import { and, eq, isNotNull, lt, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { reminders, tasks } from "../db/schema/index.js";
import { enqueueReminder } from "./reminder-queue.js";
import { enqueueTask } from "./task-queue.js";

/**
 * Boot-time reconciliation. Two responsibilities:
 *
 * 1. Mark orphaned `running` tasks as `failed`. These are tasks whose worker
 *    container was killed mid-execution (SIGKILL on Railway redeploy, OOM,
 *    etc). Without this, the row is stuck forever.
 *
 * 2. Re-enqueue BullMQ jobs for every `pending`/`scheduled` row whose job
 *    might have been lost (Redis FLUSHDB, Redis swap, container migration).
 *    BullMQ's stable jobId prevents duplicates when the job is still there.
 */
export async function reconcileOnBoot(): Promise<void> {
  console.log("[reconcile] start");

  // 1. Orphaned running tasks → failed.
  const orphans = await db
    .update(tasks)
    .set({
      status: "failed",
      error: "process restart",
      completedAt: new Date(),
    })
    .where(and(
      eq(tasks.status, "running"),
      lt(tasks.startedAt, sql`now() - interval '5 minutes'`),
    ))
    .returning({ id: tasks.id });
  if (orphans.length > 0) {
    console.log(`[reconcile] marked ${orphans.length} orphaned running task(s) as failed`);
  }

  // 2a. Pending tasks with a scheduled_at → re-enqueue with delay clamped to 0.
  const pendingScheduled = await db
    .select({ id: tasks.id, scheduledAt: tasks.scheduledAt })
    .from(tasks)
    .where(and(eq(tasks.status, "pending"), isNotNull(tasks.scheduledAt)));
  for (const row of pendingScheduled) {
    const delayMs = Math.max(0, (row.scheduledAt?.getTime() ?? Date.now()) - Date.now());
    try {
      await enqueueTask(row.id, delayMs);
    } catch (err) {
      console.warn(`[reconcile] failed to re-enqueue task ${row.id}:`, err);
    }
  }
  if (pendingScheduled.length > 0) {
    console.log(`[reconcile] re-enqueued ${pendingScheduled.length} scheduled pending task(s)`);
  }

  // 2b. Scheduled reminders → re-enqueue.
  const scheduledReminders = await db
    .select({ id: reminders.id, scheduledFor: reminders.scheduledFor })
    .from(reminders)
    .where(eq(reminders.status, "scheduled"));
  for (const row of scheduledReminders) {
    try {
      await enqueueReminder(row.id, row.scheduledFor);
    } catch (err) {
      console.warn(`[reconcile] failed to re-enqueue reminder ${row.id}:`, err);
    }
  }
  if (scheduledReminders.length > 0) {
    console.log(`[reconcile] re-enqueued ${scheduledReminders.length} scheduled reminder(s)`);
  }

  console.log("[reconcile] done");
}
