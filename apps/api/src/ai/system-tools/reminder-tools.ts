import { tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { ToolContext } from "../types.js";
import { reminders } from "../../db/schema/index.js";
import { cancelReminderJob, enqueueReminder } from "../../queue/reminder-queue.js";

function parseScheduledFor(value: string): Date | null {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function buildReminderTools(ctx: ToolContext) {
  return [
    tool(
      "schedule_reminder",
      "Schedule a persistent reminder that fires at a specific time. The reminder survives session close and server restarts. When it fires, it is posted as a system message in the current conversation (or current user's inbox if no conversation is bound). Use this whenever the user asks to be reminded, notified, or followed up with at a future time.",
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
  ];
}
