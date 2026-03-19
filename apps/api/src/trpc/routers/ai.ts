import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../index.js";
import { getPendingAction, removePendingAction } from "../../ai/pending-actions.js";
import { createTools } from "../../ai/tools.js";
import { processToolConfirmation } from "../../ai/agent.js";
import { messages } from "../../db/schema/index.js";

export const aiRouter = router({
  confirmAction: protectedProcedure
    .input(
      z.object({
        actionId: z.string(),
        confirmed: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const action = await getPendingAction(input.actionId);

      if (!action) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Action not found or expired",
        });
      }

      let toolResult: string;

      if (input.confirmed) {
        const tools = createTools({
          db: ctx.db,
          userId: ctx.session.user.id,
          conversationId: action.conversationId,
        });
        const toolDef = tools[action.toolName as keyof typeof tools];
        if (!toolDef) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Unknown tool" });
        }
        // Execute the tool
        const result = await (toolDef as any).execute(action.toolInput);
        toolResult = JSON.stringify(result);
      } else {
        toolResult = "User cancelled this action.";
      }

      await removePendingAction(input.actionId);

      // Mark original action card as resolved
      const allMsgs = await ctx.db
        .select({ id: messages.id, metadata: messages.metadata })
        .from(messages)
        .where(eq(messages.conversationId, action.conversationId));

      for (const msg of allMsgs) {
        if (!msg.metadata) continue;
        try {
          const meta = JSON.parse(msg.metadata);
          if (meta.actionCard?.actionId === input.actionId) {
            meta.actionCard.resolved = true;
            meta.actionCard.result = input.confirmed ? "confirmed" : "cancelled";
            await ctx.db
              .update(messages)
              .set({ metadata: JSON.stringify(meta) })
              .where(eq(messages.id, msg.id));
            break;
          }
        } catch {
          // skip
        }
      }

      // Process AI follow-up with stored assistant messages
      processToolConfirmation(
        action.conversationId,
        ctx.session.user.id,
        ctx.db,
        action.assistantMessages,
        action.toolCallId,
        toolResult,
      ).catch((err) => console.error("AI confirmation follow-up error:", err));

      return { success: true };
    }),
});
