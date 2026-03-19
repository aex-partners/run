import { z } from "zod";
import { eq, desc, and, isNull, isNotNull, sql, ilike, or } from "drizzle-orm";
import { router, protectedProcedure } from "../index.js";
import { files, fileShares, users } from "../../db/schema/index.js";
import { localStorage, formatFileSize } from "../../files/storage.js";
import { broadcast } from "../../ws/index.js";

export const filesRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        parentId: z.string().nullable().optional(),
        category: z.enum(["all", "starred", "recent", "shared", "trash"]).optional().default("all"),
        source: z.enum(["all", "email", "chat", "generated", "upload", "workflow"]).optional().default("all"),
        search: z.string().optional(),
        limit: z.number().min(1).max(200).default(100),
        offset: z.number().min(0).default(0),
      }).optional().default({}),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [];

      if (input.category === "trash") {
        conditions.push(isNotNull(files.deletedAt));
      } else {
        conditions.push(isNull(files.deletedAt));

        if (input.category === "starred") {
          conditions.push(eq(files.starred, 1));
        } else if (input.category === "shared") {
          // Files shared with others (has shares) or has public token
          conditions.push(
            or(
              isNotNull(files.publicToken),
              sql`EXISTS (SELECT 1 FROM file_shares WHERE file_shares.file_id = files.id)`,
            )!,
          );
        } else if (input.category === "recent") {
          // No extra filter, just sort by updatedAt desc
        } else if (input.parentId !== undefined) {
          if (input.parentId === null) {
            conditions.push(isNull(files.parentId));
          } else {
            conditions.push(eq(files.parentId, input.parentId));
          }
        }
      }

      if (input.source !== "all") {
        conditions.push(eq(files.source, input.source));
      }

      if (input.search) {
        conditions.push(ilike(files.name, `%${input.search}%`));
      }

      conditions.push(eq(files.ownerId, ctx.session.user.id));

      const where = conditions.length === 1 ? conditions[0] : and(...conditions);

      const rows = await ctx.db
        .select()
        .from(files)
        .where(where)
        .orderBy(desc(files.isFolder), desc(files.updatedAt))
        .limit(input.limit)
        .offset(input.offset);

      return rows.map((row) => ({
        id: row.id,
        name: row.name,
        type: row.type,
        size: formatFileSize(row.size),
        modifiedAt: formatDate(row.updatedAt),
        source: row.source,
        sourceRef: row.sourceRef,
        starred: row.starred === 1,
        shared: row.publicToken !== null,
        isFolder: row.isFolder === 1,
        parentId: row.parentId,
        aiIndexed: row.aiIndexed === 1,
      }));
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [file] = await ctx.db
        .select()
        .from(files)
        .where(eq(files.id, input.id))
        .limit(1);
      if (!file) return null;
      return {
        ...file,
        size: formatFileSize(file.size),
        starred: file.starred === 1,
        isFolder: file.isFolder === 1,
        aiIndexed: file.aiIndexed === 1,
      };
    }),

  createFolder: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      parentId: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const id = crypto.randomUUID();
      const [folder] = await ctx.db
        .insert(files)
        .values({
          id,
          name: input.name,
          type: "folder",
          isFolder: 1,
          ownerId: ctx.session.user.id,
          parentId: input.parentId ?? null,
        })
        .returning();

      broadcast({ type: "file_updated" });
      return folder;
    }),

  rename: protectedProcedure
    .input(z.object({ id: z.string(), name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(files)
        .set({ name: input.name, updatedAt: new Date() })
        .where(eq(files.id, input.id));
      broadcast({ type: "file_updated" });
      return { success: true };
    }),

  move: protectedProcedure
    .input(z.object({ id: z.string(), parentId: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(files)
        .set({ parentId: input.parentId, updatedAt: new Date() })
        .where(eq(files.id, input.id));
      broadcast({ type: "file_updated" });
      return { success: true };
    }),

  star: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [file] = await ctx.db
        .select({ starred: files.starred })
        .from(files)
        .where(eq(files.id, input.id))
        .limit(1);
      if (!file) return { error: "File not found" };

      const newStarred = file.starred === 1 ? 0 : 1;
      await ctx.db
        .update(files)
        .set({ starred: newStarred, updatedAt: new Date() })
        .where(eq(files.id, input.id));
      broadcast({ type: "file_updated" });
      return { starred: newStarred === 1 };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(files)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(files.id, input.id));
      broadcast({ type: "file_updated" });
      return { success: true };
    }),

  restore: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(files)
        .set({ deletedAt: null, updatedAt: new Date() })
        .where(eq(files.id, input.id));
      broadcast({ type: "file_updated" });
      return { success: true };
    }),

  permanentDelete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [file] = await ctx.db
        .select({ path: files.path, isFolder: files.isFolder })
        .from(files)
        .where(eq(files.id, input.id))
        .limit(1);
      if (!file) return { error: "File not found" };

      if (file.path && file.isFolder === 0) {
        await localStorage.deleteFile(file.path);
      }

      await ctx.db.delete(files).where(eq(files.id, input.id));
      broadcast({ type: "file_updated" });
      return { success: true };
    }),

  emptyTrash: protectedProcedure
    .mutation(async ({ ctx }) => {
      const trashedFiles = await ctx.db
        .select({ id: files.id, path: files.path, isFolder: files.isFolder })
        .from(files)
        .where(and(isNotNull(files.deletedAt), eq(files.ownerId, ctx.session.user.id)));

      for (const file of trashedFiles) {
        if (file.path && file.isFolder === 0) {
          await localStorage.deleteFile(file.path);
        }
      }

      await ctx.db
        .delete(files)
        .where(and(isNotNull(files.deletedAt), eq(files.ownerId, ctx.session.user.id)));

      broadcast({ type: "file_updated" });
      return { deleted: trashedFiles.length };
    }),

  toggleAiIndex: protectedProcedure
    .input(z.object({ id: z.string(), enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(files)
        .set({ aiIndexed: input.enabled ? 1 : 0, updatedAt: new Date() })
        .where(eq(files.id, input.id));
      broadcast({ type: "file_updated" });
      return { aiIndexed: input.enabled };
    }),

  categoryCounts: protectedProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.session.user.id;
      const [result] = await ctx.db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE deleted_at IS NULL) as "all",
          COUNT(*) FILTER (WHERE deleted_at IS NULL AND starred = 1) as starred,
          COUNT(*) FILTER (WHERE deleted_at IS NULL AND updated_at >= NOW() - INTERVAL '7 days') as recent,
          COUNT(*) FILTER (WHERE deleted_at IS NULL AND (
            public_token IS NOT NULL
            OR EXISTS (SELECT 1 FROM file_shares WHERE file_shares.file_id = files.id)
          )) as shared,
          COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) as trash
        FROM files
        WHERE owner_id = ${userId}
      `);

      return {
        all: Number(result.all) || 0,
        starred: Number(result.starred) || 0,
        recent: Number(result.recent) || 0,
        shared: Number(result.shared) || 0,
        trash: Number(result.trash) || 0,
      };
    }),

  share: router({
    getData: protectedProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ ctx, input }) => {
        const [file] = await ctx.db
          .select({ publicToken: files.publicToken })
          .from(files)
          .where(eq(files.id, input.id))
          .limit(1);

        if (!file) return { publicLink: null, publicEnabled: false, sharedWith: [] };

        const shares = await ctx.db
          .select({
            id: fileShares.id,
            userId: fileShares.userId,
            access: fileShares.access,
            userName: users.name,
            userEmail: users.email,
          })
          .from(fileShares)
          .innerJoin(users, eq(fileShares.userId, users.id))
          .where(eq(fileShares.fileId, input.id));

        return {
          publicLink: file.publicToken ? `/api/files/public/${file.publicToken}` : null,
          publicEnabled: file.publicToken !== null,
          sharedWith: shares.map((s) => ({
            id: s.userId,
            name: s.userName || s.userEmail || "Unknown",
            email: s.userEmail || "",
            access: s.access as "viewer" | "editor",
          })),
        };
      }),

    togglePublic: protectedProcedure
      .input(z.object({ id: z.string(), enabled: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        const token = input.enabled ? crypto.randomUUID() : null;
        await ctx.db
          .update(files)
          .set({ publicToken: token, updatedAt: new Date() })
          .where(eq(files.id, input.id));
        broadcast({ type: "file_updated" });
        return { publicToken: token };
      }),

    addUser: protectedProcedure
      .input(z.object({
        fileId: z.string(),
        email: z.string().email(),
        access: z.enum(["viewer", "editor"]).default("viewer"),
      }))
      .mutation(async ({ ctx, input }) => {
        const [user] = await ctx.db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, input.email))
          .limit(1);
        if (!user) return { error: "User not found" };

        const existing = await ctx.db
          .select({ id: fileShares.id })
          .from(fileShares)
          .where(and(eq(fileShares.fileId, input.fileId), eq(fileShares.userId, user.id)))
          .limit(1);
        if (existing.length > 0) return { error: "Already shared" };

        await ctx.db.insert(fileShares).values({
          id: crypto.randomUUID(),
          fileId: input.fileId,
          userId: user.id,
          access: input.access,
        });
        broadcast({ type: "file_updated" });
        return { success: true };
      }),

    removeUser: protectedProcedure
      .input(z.object({ fileId: z.string(), userId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await ctx.db
          .delete(fileShares)
          .where(and(eq(fileShares.fileId, input.fileId), eq(fileShares.userId, input.userId)));
        broadcast({ type: "file_updated" });
        return { success: true };
      }),

    changeAccess: protectedProcedure
      .input(z.object({
        fileId: z.string(),
        userId: z.string(),
        access: z.enum(["viewer", "editor"]),
      }))
      .mutation(async ({ ctx, input }) => {
        await ctx.db
          .update(fileShares)
          .set({ access: input.access })
          .where(and(eq(fileShares.fileId, input.fileId), eq(fileShares.userId, input.userId)));
        broadcast({ type: "file_updated" });
        return { success: true };
      }),
  }),
});

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
