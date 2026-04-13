import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { and, desc, asc, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { ToolContext } from "../types.js";
import { reminders, tasks } from "../../db/schema/index.js";
import { cancelReminderJob, enqueueReminder } from "../../queue/reminder-queue.js";
import { cancelTaskJob, enqueueTask } from "../../queue/task-queue.js";

function parseScheduledFor(value: string): Date | null {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function buildReminderTools(ctx: ToolContext) {
  return [
    tool(
      "schedule_reminder",
      "Schedule a persistent human-facing reminder that fires at a specific time. The reminder is a plain text notification that is posted as a system message into the conversation (or pushed to the user's inbox if unbound). It does NOT execute any work. Use this when the user wants to be nudged, notified, or followed up with. For scheduling actual work (generate a PDF later, send an email later, run a query later), use `schedule_task` instead.",
      {
        message: z.string().min(1).describe("The reminder text, as it will appear to the user when it fires."),
        scheduled_for: z.string().describe("ISO 8601 datetime for when the reminder should fire (e.g. '2026-04-14T15:00:00-03:00'). Must be in the future."),
        bind_to_conversation: z.boolean().optional().describe("If true (default), the reminder fires as a message in the current conversation. If false, it fires as a private notification to the user."),
      },
      async ({ message, scheduled_for, bind_to_conversation }) => {
        const when = parseScheduledFor(scheduled_for);
        if (!when) {
          return { content: [{ type: "text" as const, text: `Invalid scheduled_for: "${scheduled_for}"` }], isError: true };
        }
        if (when.getTime() <= Date.now()) {
          return { content: [{ type: "text" as const, text: "scheduled_for must be in the future" }], isError: true };
        }

        const id = randomUUID();
        const bindConversation = bind_to_conversation !== false;
        const conversationId = bindConversation ? ctx.conversationId : null;

        const jobId = `reminder-${id}`;
        await ctx.db.insert(reminders).values({
          id,
          userId: ctx.userId,
          conversationId,
          message,
          scheduledFor: when,
          status: "scheduled",
          jobId,
        });

        await enqueueReminder(id, when);

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              reminder_id: id,
              scheduled_for: when.toISOString(),
              fires_in_seconds: Math.round((when.getTime() - Date.now()) / 1000),
              conversation_bound: Boolean(conversationId),
            }),
          }],
        };
      },
    ),

    tool(
      "list_reminders",
      "List reminders for the current user. Returns scheduled ones by default; pass include_fired=true to also see already-fired history.",
      {
        status: z.enum(["scheduled", "fired", "cancelled"]).optional().describe("Filter by status. Defaults to 'scheduled'."),
        limit: z.number().optional().describe("Max rows to return (default 20)."),
      },
      async ({ status, limit }) => {
        const filterStatus = status ?? "scheduled";
        const rows = await ctx.db
          .select()
          .from(reminders)
          .where(and(eq(reminders.userId, ctx.userId), eq(reminders.status, filterStatus)))
          .orderBy(asc(reminders.scheduledFor))
          .limit(limit ?? 20);

        const result = rows.map((r) => ({
          id: r.id,
          message: r.message,
          scheduled_for: r.scheduledFor.toISOString(),
          status: r.status,
          conversation_bound: Boolean(r.conversationId),
          fired_at: r.firedAt?.toISOString() ?? null,
        }));

        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      },
      { annotations: { readOnlyHint: true } },
    ),

    tool(
      "cancel_reminder",
      "Cancel a scheduled reminder so it will not fire. No-op if already fired or cancelled.",
      {
        reminder_id: z.string().describe("ID of the reminder to cancel (from list_reminders or schedule_reminder)."),
      },
      async ({ reminder_id }) => {
        const [row] = await ctx.db
          .select()
          .from(reminders)
          .where(and(eq(reminders.id, reminder_id), eq(reminders.userId, ctx.userId)))
          .limit(1);
        if (!row) {
          return { content: [{ type: "text" as const, text: `Reminder "${reminder_id}" not found` }], isError: true };
        }
        if (row.status !== "scheduled") {
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, already: row.status }) }] };
        }

        await cancelReminderJob(reminder_id);
        await ctx.db
          .update(reminders)
          .set({ status: "cancelled", updatedAt: new Date() })
          .where(eq(reminders.id, reminder_id));

        return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, cancelled: reminder_id }) }] };
      },
    ),

    tool(
      "list_tasks",
      "List scheduled or in-flight tasks created by the current user. Defaults to pending+running so you can see what is queued or in progress; pass `status` to narrow it down. Each row includes id, title, status, scheduled_for and conversation binding.",
      {
        status: z.enum(["pending", "running", "completed", "failed", "cancelled"]).optional().describe("Filter by a single status. If omitted, returns pending + running."),
        limit: z.number().optional().describe("Max rows to return (default 20)."),
      },
      async ({ status, limit }) => {
        const baseFilter = status
          ? eq(tasks.status, status)
          : inArray(tasks.status, ["pending", "running"]);

        const rows = await ctx.db
          .select()
          .from(tasks)
          .where(and(eq(tasks.createdBy, ctx.userId), baseFilter))
          .orderBy(asc(tasks.scheduledAt), desc(tasks.createdAt))
          .limit(limit ?? 20);

        const result = rows.map((r) => ({
          id: r.id,
          title: r.title,
          status: r.status,
          type: r.type,
          scheduled_for: r.scheduledAt?.toISOString() ?? null,
          conversation_id: r.conversationId,
          started_at: r.startedAt?.toISOString() ?? null,
          completed_at: r.completedAt?.toISOString() ?? null,
        }));

        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      },
      { annotations: { readOnlyHint: true } },
    ),

    tool(
      "cancel_task",
      "Cancel a scheduled task that has not started yet. If the task is already running it stays as-is (no kill switch); if it already completed/failed/cancelled this is a no-op. Use this whenever the user changes their mind, you scheduled with the wrong time and need to clean up, or you want to clear duplicates.",
      {
        task_id: z.string().describe("ID of the task to cancel (from list_tasks or schedule_task)."),
      },
      async ({ task_id }) => {
        const [row] = await ctx.db
          .select()
          .from(tasks)
          .where(and(eq(tasks.id, task_id), eq(tasks.createdBy, ctx.userId)))
          .limit(1);
        if (!row) {
          return { content: [{ type: "text" as const, text: `Task "${task_id}" not found` }], isError: true };
        }
        if (row.status !== "pending") {
          return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, already: row.status, task_id }) }] };
        }

        await cancelTaskJob(task_id);
        await ctx.db
          .update(tasks)
          .set({ status: "cancelled", completedAt: new Date() })
          .where(eq(tasks.id, task_id));

        return { content: [{ type: "text" as const, text: JSON.stringify({ success: true, cancelled: task_id }) }] };
      },
    ),

    tool(
      "schedule_task",
      "Schedule the agent to actually run a prompt at a future time. When the scheduled time arrives, the agent is re-invoked in the bound conversation with the stored prompt and full access to its tools (generate_pdf, send_email, query_records, insert_record, update_record, etc). Use this whenever the user asks to produce a document later, send an email later, run a query later, or do any work at a future time. Do NOT use `schedule_reminder` for these cases, and NEVER attempt to use harness tools like `CronCreate`, `ScheduleWakeup`, or shell cron.",
      {
        title: z.string().min(1).describe("Short human-readable title for the scheduled task (shown in the Tasks module)."),
        prompt: z.string().min(1).describe("The exact prompt the agent will be given when the task fires. Write it self-contained, as if the user were asking now, because there is no chat history carried across."),
        scheduled_for: z.string().describe("ISO 8601 datetime for when the task should run (e.g. '2026-04-14T15:00:00-03:00'). Must be in the future."),
      },
      async ({ title, prompt, scheduled_for }) => {
        const when = new Date(scheduled_for);
        if (Number.isNaN(when.getTime())) {
          return { content: [{ type: "text" as const, text: `Invalid scheduled_for: "${scheduled_for}"` }], isError: true };
        }
        if (when.getTime() <= Date.now()) {
          return { content: [{ type: "text" as const, text: "scheduled_for must be in the future" }], isError: true };
        }
        if (!ctx.conversationId) {
          return { content: [{ type: "text" as const, text: "schedule_task requires an active conversation so the result has somewhere to land" }], isError: true };
        }

        const id = randomUUID();
        await ctx.db.insert(tasks).values({
          id,
          title,
          description: null,
          status: "pending",
          progress: 0,
          conversationId: ctx.conversationId,
          createdBy: ctx.userId,
          input: prompt,
          scheduledAt: when,
          type: "inference",
        });

        const delayMs = Math.max(0, when.getTime() - Date.now());
        await enqueueTask(id, delayMs);

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              success: true,
              task_id: id,
              title,
              scheduled_for: when.toISOString(),
              fires_in_seconds: Math.round(delayMs / 1000),
            }),
          }],
        };
      },
    ),
  ];
}
