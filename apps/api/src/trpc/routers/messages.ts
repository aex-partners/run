import { z } from "zod";
import { eq, desc, lt, and, sql, isNull } from "drizzle-orm";
import { router, protectedProcedure } from "../index.js";
import { messages, conversationMembers, conversations, users, agents } from "../../db/schema/index.js";
import { sendToUser, broadcast } from "../../ws/index.js";
import { DEFAULT_AGENT_NAME } from "@aex/shared";

export const messagesRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        conversationId: z.string(),
        cursor: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where = input.cursor
        ? and(
            eq(messages.conversationId, input.conversationId),
            lt(messages.createdAt, new Date(input.cursor)),
            isNull(messages.deletedAt),
          )
        : and(
            eq(messages.conversationId, input.conversationId),
            isNull(messages.deletedAt),
          );

      const items = await ctx.db
        .select({
          id: messages.id,
          conversationId: messages.conversationId,
          authorId: messages.authorId,
          agentId: messages.agentId,
          authorName: sql<string>`COALESCE(${users.name}, ${agents.name}, ${DEFAULT_AGENT_NAME})`,
          metadata: messages.metadata,
          content: messages.content,
          role: messages.role,
          pinned: messages.pinned,
          starred: messages.starred,
          reactions: messages.reactions,
          deletedFor: messages.deletedFor,
          audioUrl: messages.audioUrl,
          audioDuration: messages.audioDuration,
          audioWaveform: messages.audioWaveform,
          audioTranscription: messages.audioTranscription,
          audioTranscriptionEdited: messages.audioTranscriptionEdited,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .leftJoin(users, eq(messages.authorId, users.id))
        .leftJoin(agents, eq(messages.agentId, agents.id))
        .where(where)
        .orderBy(desc(messages.createdAt))
        .limit(input.limit + 1);

      let nextCursor: string | undefined;
      if (items.length > input.limit) {
        const next = items.pop()!;
        nextCursor = next.createdAt.toISOString();
      }

      // Filter out messages deleted for current user
      const userId = ctx.session.user.id;
      const filtered = items.filter((item) => {
        if (!item.deletedFor) return true;
        try {
          const deletedForIds: string[] = JSON.parse(item.deletedFor);
          return !deletedForIds.includes(userId);
        } catch {
          return true;
        }
      });

      return { items: filtered, nextCursor };
    }),

  send: protectedProcedure
    .input(
      z.object({
        conversationId: z.string(),
        content: z.string().min(1),
        role: z.enum(["user", "ai", "system"]).default("user"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const id = crypto.randomUUID();
      const [message] = await ctx.db
        .insert(messages)
        .values({
          id,
          conversationId: input.conversationId,
          authorId: ctx.session.user.id,
          content: input.content,
          role: input.role,
        })
        .returning();

      // Generate embedding asynchronously

      const authorName = ctx.session.user.name;

      // Broadcast to all conversation members via WebSocket
      const members = await ctx.db
        .select({ userId: conversationMembers.userId })
        .from(conversationMembers)
        .where(eq(conversationMembers.conversationId, input.conversationId));

      const payload = {
        type: "new_message",
        message: {
          id: message.id,
          conversationId: message.conversationId,
          authorId: message.authorId,
          authorName,
          content: message.content,
          role: message.role,
          createdAt: message.createdAt.toISOString(),
        },
      };

      for (const member of members) {
        if (member.userId !== ctx.session.user.id) {
          sendToUser(member.userId, payload);
        }
      }

      // Trigger AI processing for AI conversations
      const [conv] = await ctx.db
        .select({ type: conversations.type })
        .from(conversations)
        .where(eq(conversations.id, input.conversationId))
        .limit(1);

      return { ...message, authorName };
    }),

  markQuickReplyAnswered: protectedProcedure
    .input(z.object({ messageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [msg] = await ctx.db
        .select({ id: messages.id, metadata: messages.metadata })
        .from(messages)
        .where(eq(messages.id, input.messageId))
        .limit(1);

      if (!msg?.metadata) return { success: true };

      try {
        const meta = JSON.parse(msg.metadata);
        if (meta.quickReplies) {
          meta.quickReplies.answered = true;
          await ctx.db
            .update(messages)
            .set({ metadata: JSON.stringify(meta) })
            .where(eq(messages.id, input.messageId));
        }
      } catch {
        // skip
      }

      return { success: true };
    }),

  pin: protectedProcedure
    .input(z.object({ messageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [msg] = await ctx.db
        .select({ id: messages.id, pinned: messages.pinned, conversationId: messages.conversationId })
        .from(messages)
        .where(eq(messages.id, input.messageId))
        .limit(1);

      if (!msg) return { error: "Message not found" };

      const newPinned = msg.pinned === 1 ? 0 : 1;
      await ctx.db
        .update(messages)
        .set({ pinned: newPinned })
        .where(eq(messages.id, input.messageId));

      broadcast({
        type: "message_updated",
        messageId: input.messageId,
        conversationId: msg.conversationId,
        pinned: newPinned === 1,
      });

      return { success: true, pinned: newPinned === 1 };
    }),

  star: protectedProcedure
    .input(z.object({ messageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [msg] = await ctx.db
        .select({ id: messages.id, starred: messages.starred, conversationId: messages.conversationId })
        .from(messages)
        .where(eq(messages.id, input.messageId))
        .limit(1);

      if (!msg) return { error: "Message not found" };

      const newStarred = msg.starred === 1 ? 0 : 1;
      await ctx.db
        .update(messages)
        .set({ starred: newStarred })
        .where(eq(messages.id, input.messageId));

      broadcast({
        type: "message_updated",
        messageId: input.messageId,
        conversationId: msg.conversationId,
        starred: newStarred === 1,
      });

      return { success: true, starred: newStarred === 1 };
    }),

  deleteForEveryone: protectedProcedure
    .input(z.object({ messageIds: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      for (const messageId of input.messageIds) {
        const [msg] = await ctx.db
          .select({ id: messages.id, conversationId: messages.conversationId })
          .from(messages)
          .where(eq(messages.id, messageId))
          .limit(1);

        if (msg) {
          await ctx.db
            .update(messages)
            .set({ deletedAt: new Date() })
            .where(eq(messages.id, messageId));

          broadcast({
            type: "message_deleted",
            messageId,
            conversationId: msg.conversationId,
          });
        }
      }

      return { success: true };
    }),

  deleteForMe: protectedProcedure
    .input(z.object({ messageIds: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;

      for (const messageId of input.messageIds) {
        const [msg] = await ctx.db
          .select({ id: messages.id, deletedFor: messages.deletedFor })
          .from(messages)
          .where(eq(messages.id, messageId))
          .limit(1);

        if (msg) {
          let deletedForIds: string[] = [];
          if (msg.deletedFor) {
            try {
              deletedForIds = JSON.parse(msg.deletedFor);
            } catch {
              deletedForIds = [];
            }
          }
          if (!deletedForIds.includes(userId)) {
            deletedForIds.push(userId);
          }
          await ctx.db
            .update(messages)
            .set({ deletedFor: JSON.stringify(deletedForIds) })
            .where(eq(messages.id, messageId));
        }
      }

      return { success: true };
    }),

  react: protectedProcedure
    .input(z.object({ messageId: z.string(), emoji: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const [msg] = await ctx.db
        .select({ id: messages.id, reactions: messages.reactions, conversationId: messages.conversationId })
        .from(messages)
        .where(eq(messages.id, input.messageId))
        .limit(1);

      if (!msg) return { error: "Message not found" };

      let reactionsList: { emoji: string; userId: string }[] = [];
      if (msg.reactions) {
        try {
          reactionsList = JSON.parse(msg.reactions);
        } catch {
          reactionsList = [];
        }
      }

      // Toggle: remove if already reacted with same emoji, add otherwise
      const existingIdx = reactionsList.findIndex(
        (r) => r.emoji === input.emoji && r.userId === userId,
      );
      if (existingIdx >= 0) {
        reactionsList.splice(existingIdx, 1);
      } else {
        reactionsList.push({ emoji: input.emoji, userId });
      }

      await ctx.db
        .update(messages)
        .set({ reactions: JSON.stringify(reactionsList) })
        .where(eq(messages.id, input.messageId));

      broadcast({
        type: "message_updated",
        messageId: input.messageId,
        conversationId: msg.conversationId,
        reactions: reactionsList,
      });

      return { success: true, reactions: reactionsList };
    }),

  forward: protectedProcedure
    .input(
      z.object({
        messageIds: z.array(z.string()),
        recipientConversationIds: z.array(z.string()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session.user.id;
      const authorName = ctx.session.user.name;

      // Fetch original messages
      const originalMessages = [];
      for (const msgId of input.messageIds) {
        const [msg] = await ctx.db
          .select({
            id: messages.id,
            content: messages.content,
            authorId: messages.authorId,
            authorName: sql<string>`COALESCE(${users.name}, ${agents.name}, 'Unknown')`,
          })
          .from(messages)
          .leftJoin(users, eq(messages.authorId, users.id))
          .leftJoin(agents, eq(messages.agentId, agents.id))
          .where(eq(messages.id, msgId))
          .limit(1);
        if (msg) originalMessages.push(msg);
      }

      // Create forwarded messages in each recipient conversation
      for (const convId of input.recipientConversationIds) {
        for (const orig of originalMessages) {
          const id = crypto.randomUUID();
          const metadata = JSON.stringify({
            forwardedFrom: {
              messageId: orig.id,
              authorName: orig.authorName,
            },
          });

          await ctx.db.insert(messages).values({
            id,
            conversationId: convId,
            authorId: userId,
            content: orig.content,
            role: "user",
            metadata,
          });

          // Broadcast to conversation members
          const members = await ctx.db
            .select({ userId: conversationMembers.userId })
            .from(conversationMembers)
            .where(eq(conversationMembers.conversationId, convId));

          const payload = {
            type: "new_message",
            message: {
              id,
              conversationId: convId,
              authorId: userId,
              authorName,
              content: orig.content,
              role: "user",
              createdAt: new Date().toISOString(),
              metadata,
            },
          };

          for (const member of members) {
            if (member.userId !== userId) {
              sendToUser(member.userId, payload);
            }
          }
        }
      }

      return { success: true };
    }),

  sendAudio: protectedProcedure
    .input(
      z.object({
        conversationId: z.string(),
        audioUrl: z.string(),
        duration: z.string(),
        waveform: z.array(z.number()).optional(),
        transcription: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const id = crypto.randomUUID();
      const [message] = await ctx.db
        .insert(messages)
        .values({
          id,
          conversationId: input.conversationId,
          authorId: ctx.session.user.id,
          content: input.transcription || "[Audio message]",
          role: "user",
          audioUrl: input.audioUrl,
          audioDuration: input.duration,
          audioWaveform: input.waveform ? JSON.stringify(input.waveform) : null,
          audioTranscription: input.transcription || null,
        })
        .returning();

      const authorName = ctx.session.user.name;

      // Broadcast to conversation members
      const members = await ctx.db
        .select({ userId: conversationMembers.userId })
        .from(conversationMembers)
        .where(eq(conversationMembers.conversationId, input.conversationId));

      const payload = {
        type: "new_message",
        message: {
          id: message.id,
          conversationId: message.conversationId,
          authorId: message.authorId,
          authorName,
          content: message.content,
          role: message.role,
          audioUrl: message.audioUrl,
          audioDuration: message.audioDuration,
          createdAt: message.createdAt.toISOString(),
        },
      };

      for (const member of members) {
        if (member.userId !== ctx.session.user.id) {
          sendToUser(member.userId, payload);
        }
      }

      return { ...message, authorName };
    }),

  editTranscription: protectedProcedure
    .input(z.object({ messageId: z.string(), transcription: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(messages)
        .set({
          audioTranscription: input.transcription,
          audioTranscriptionEdited: 1,
        })
        .where(eq(messages.id, input.messageId));

      return { success: true };
    }),
});
