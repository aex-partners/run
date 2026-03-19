import { z } from "zod";
import { eq, and, inArray, desc, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../index.js";
import {
  conversations,
  conversationMembers,
  messages,
} from "../../db/schema/index.js";

export const conversationsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const memberships = await ctx.db
      .select({ conversationId: conversationMembers.conversationId })
      .from(conversationMembers)
      .where(eq(conversationMembers.userId, ctx.session.user.id));

    if (memberships.length === 0) return [];

    const ids = memberships.map((m) => m.conversationId);

    const lastMessageSq = ctx.db
      .select({
        conversationId: messages.conversationId,
        lastMessage: sql<string>`(array_agg(${messages.content} ORDER BY ${messages.createdAt} DESC))[1]`.as(
          "last_message",
        ),
        lastMessageAt:
          sql<Date>`max(${messages.createdAt})`.as("last_message_at"),
      })
      .from(messages)
      .where(inArray(messages.conversationId, ids))
      .groupBy(messages.conversationId)
      .as("lm");

    const rows = await ctx.db
      .select({
        id: conversations.id,
        name: conversations.name,
        type: conversations.type,
        agentId: conversations.agentId,
        createdAt: conversations.createdAt,
        lastMessage: lastMessageSq.lastMessage,
        lastMessageAt: lastMessageSq.lastMessageAt,
      })
      .from(conversations)
      .leftJoin(lastMessageSq, eq(conversations.id, lastMessageSq.conversationId))
      .where(inArray(conversations.id, ids))
      .orderBy(desc(sql`coalesce(${lastMessageSq.lastMessageAt}, ${conversations.createdAt})`));

    // Compute unread counts: messages after lastReadAt, not sent by current user
    const unreadRows = await ctx.db
      .select({
        conversationId: messages.conversationId,
        count: sql<number>`count(*)::int`,
      })
      .from(messages)
      .innerJoin(
        conversationMembers,
        and(
          eq(messages.conversationId, conversationMembers.conversationId),
          eq(conversationMembers.userId, ctx.session.user.id),
        ),
      )
      .where(
        and(
          inArray(messages.conversationId, ids),
          sql`${messages.authorId} IS DISTINCT FROM ${ctx.session.user.id}`,
          sql`${messages.createdAt} > ${conversationMembers.lastReadAt}`,
        ),
      )
      .groupBy(messages.conversationId);

    const unreadMap = new Map(unreadRows.map((r) => [r.conversationId, r.count]));

    // Get membership flags (pinned, favorite, muted)
    const flagRows = await ctx.db
      .select({
        conversationId: conversationMembers.conversationId,
        pinned: conversationMembers.pinned,
        favorite: conversationMembers.favorite,
        muted: conversationMembers.muted,
      })
      .from(conversationMembers)
      .where(
        and(
          inArray(conversationMembers.conversationId, ids),
          eq(conversationMembers.userId, ctx.session.user.id),
        ),
      );
    const flagMap = new Map(flagRows.map((r) => [r.conversationId, r]));

    return rows.map((r) => {
      const flags = flagMap.get(r.id);
      return {
        id: r.id,
        name: r.name,
        type: r.type,
        agentId: r.agentId,
        createdAt: r.createdAt,
        lastMessage: r.lastMessage ?? "",
        lastMessageAt: r.lastMessageAt
          ? new Date(r.lastMessageAt).toISOString()
          : r.createdAt.toISOString(),
        unreadCount: unreadMap.get(r.id) ?? 0,
        pinned: flags?.pinned === 1,
        favorite: flags?.favorite === 1,
        muted: flags?.muted === 1,
      };
    });
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const results = await ctx.db
        .select()
        .from(conversations)
        .where(eq(conversations.id, input.id))
        .limit(1);
      return results[0] ?? null;
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().optional(),
        type: z.enum(["dm", "channel", "ai"]).default("ai"),
        memberIds: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const id = crypto.randomUUID();
      const [conversation] = await ctx.db
        .insert(conversations)
        .values({ id, name: input.name, type: input.type })
        .returning();
      // Always add the creator as a member
      const members = [{ conversationId: id, userId: ctx.session.user.id }];
      // Add additional members if provided
      if (input.memberIds) {
        for (const memberId of input.memberIds) {
          if (memberId !== ctx.session.user.id) {
            members.push({ conversationId: id, userId: memberId });
          }
        }
      }
      await ctx.db.insert(conversationMembers).values(members);
      return conversation;
    }),

  addMember: protectedProcedure
    .input(
      z.object({
        conversationId: z.string(),
        userId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.insert(conversationMembers).values({
        conversationId: input.conversationId,
        userId: input.userId,
      });
      return { success: true };
    }),

  rename: protectedProcedure
    .input(z.object({ id: z.string(), name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const membership = await ctx.db
        .select()
        .from(conversationMembers)
        .where(
          sql`${conversationMembers.conversationId} = ${input.id} AND ${conversationMembers.userId} = ${ctx.session.user.id}`,
        )
        .limit(1);

      if (membership.length === 0) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not a member" });
      }

      const [updated] = await ctx.db
        .update(conversations)
        .set({ name: input.name, updatedAt: new Date() })
        .where(eq(conversations.id, input.id))
        .returning();

      return updated;
    }),

  markRead: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(conversationMembers)
        .set({ lastReadAt: new Date() })
        .where(
          and(
            eq(conversationMembers.conversationId, input.id),
            eq(conversationMembers.userId, ctx.session.user.id),
          ),
        );
      return { success: true };
    }),

  pin: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [membership] = await ctx.db
        .select({ pinned: conversationMembers.pinned })
        .from(conversationMembers)
        .where(
          and(
            eq(conversationMembers.conversationId, input.id),
            eq(conversationMembers.userId, ctx.session.user.id),
          ),
        )
        .limit(1);
      if (!membership) throw new TRPCError({ code: "NOT_FOUND" });
      const newVal = membership.pinned === 1 ? 0 : 1;
      await ctx.db
        .update(conversationMembers)
        .set({ pinned: newVal })
        .where(
          and(
            eq(conversationMembers.conversationId, input.id),
            eq(conversationMembers.userId, ctx.session.user.id),
          ),
        );
      return { pinned: newVal === 1 };
    }),

  favorite: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [membership] = await ctx.db
        .select({ favorite: conversationMembers.favorite })
        .from(conversationMembers)
        .where(
          and(
            eq(conversationMembers.conversationId, input.id),
            eq(conversationMembers.userId, ctx.session.user.id),
          ),
        )
        .limit(1);
      if (!membership) throw new TRPCError({ code: "NOT_FOUND" });
      const newVal = membership.favorite === 1 ? 0 : 1;
      await ctx.db
        .update(conversationMembers)
        .set({ favorite: newVal })
        .where(
          and(
            eq(conversationMembers.conversationId, input.id),
            eq(conversationMembers.userId, ctx.session.user.id),
          ),
        );
      return { favorite: newVal === 1 };
    }),

  mute: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [membership] = await ctx.db
        .select({ muted: conversationMembers.muted })
        .from(conversationMembers)
        .where(
          and(
            eq(conversationMembers.conversationId, input.id),
            eq(conversationMembers.userId, ctx.session.user.id),
          ),
        )
        .limit(1);
      if (!membership) throw new TRPCError({ code: "NOT_FOUND" });
      const newVal = membership.muted === 1 ? 0 : 1;
      await ctx.db
        .update(conversationMembers)
        .set({ muted: newVal })
        .where(
          and(
            eq(conversationMembers.conversationId, input.id),
            eq(conversationMembers.userId, ctx.session.user.id),
          ),
        );
      return { muted: newVal === 1 };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const membership = await ctx.db
        .select()
        .from(conversationMembers)
        .where(
          sql`${conversationMembers.conversationId} = ${input.id} AND ${conversationMembers.userId} = ${ctx.session.user.id}`,
        )
        .limit(1);

      if (membership.length === 0) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not a member" });
      }

      await ctx.db
        .delete(conversations)
        .where(eq(conversations.id, input.id));

      return { success: true };
    }),

  setAgent: protectedProcedure
    .input(z.object({
      conversationId: z.string(),
      agentId: z.string().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(conversations)
        .set({ agentId: input.agentId, updatedAt: new Date() })
        .where(eq(conversations.id, input.conversationId))
        .returning();

      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  getOrCreateContext: protectedProcedure
    .input(z.object({ context: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Find existing AI conversation for this context
      const contextName = `AI: ${input.context}`;
      const memberships = await ctx.db
        .select({ conversationId: conversationMembers.conversationId })
        .from(conversationMembers)
        .where(eq(conversationMembers.userId, ctx.session.user.id));

      if (memberships.length > 0) {
        const convIds = memberships.map((m) => m.conversationId);
        const existing = await ctx.db
          .select({ id: conversations.id })
          .from(conversations)
          .where(
            and(
              inArray(conversations.id, convIds),
              eq(conversations.type, "ai"),
              eq(conversations.name, contextName),
            ),
          )
          .limit(1);

        if (existing.length > 0) {
          return { id: existing[0].id };
        }
      }

      // Create new context conversation
      const id = crypto.randomUUID();
      await ctx.db
        .insert(conversations)
        .values({ id, name: contextName, type: "ai" });
      await ctx.db
        .insert(conversationMembers)
        .values({ conversationId: id, userId: ctx.session.user.id });

      return { id };
    }),

});
