import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../index.js";
import { users, conversations, conversationMembers } from "../../db/schema/index.js";
import { auth } from "../../auth/index.js";
import { ensureEricConversationForUser } from "../../services/eric-conversation.js";

const isAdminOrOwner = (role: string) => role === "admin" || role === "owner";

const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (!isAdminOrOwner(ctx.session.user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

export const usersRouter = router({
  list: adminProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        banned: users.banned,
        createdAt: users.createdAt,
      })
      .from(users);

    return rows.map((u) => ({
      ...u,
      status: u.banned ? ("inactive" as const) : ("active" as const),
    }));
  }),

  invite: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(6),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const res = await auth.api.signUpEmail({
        body: {
          name: input.name,
          email: input.email,
          password: input.password,
        },
      });

      if (!res.user) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Failed to create user" });
      }

      // Auto-create a DM conversation between the inviter and the new user
      const dmId = crypto.randomUUID();
      await ctx.db.insert(conversations).values({
        id: dmId,
        name: input.name,
        type: "dm",
      });
      await ctx.db.insert(conversationMembers).values([
        { conversationId: dmId, userId: ctx.session.user.id },
        { conversationId: dmId, userId: res.user.id },
      ]);

      await ensureEricConversationForUser(ctx.db, res.user.id);

      return { id: res.user.id, email: input.email };
    }),

  updateRole: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        role: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.session.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot change your own role" });
      }

      // Only owners can promote to owner or demote another owner
      const [target] = await ctx.db
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      if (target.role === "owner" && ctx.session.user.role !== "owner") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only owners can change another owner's role" });
      }

      if (input.role === "owner" && ctx.session.user.role !== "owner") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only owners can promote to owner" });
      }

      await ctx.db
        .update(users)
        .set({ role: input.role })
        .where(eq(users.id, input.userId));

      return { success: true };
    }),

  updateStatus: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        status: z.enum(["active", "inactive"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.session.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot change your own status" });
      }
      await ctx.db
        .update(users)
        .set({ banned: input.status === "inactive" })
        .where(eq(users.id, input.userId));
      return { success: true };
    }),

  updateName: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        name: z.string().min(1).max(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [target] = await ctx.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      if (!target) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      await ctx.db
        .update(users)
        .set({ name: input.name })
        .where(eq(users.id, input.userId));

      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.session.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot delete yourself" });
      }
      await ctx.db
        .delete(users)
        .where(eq(users.id, input.userId));
      return { success: true };
    }),
});
