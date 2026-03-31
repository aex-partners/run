import { z } from "zod";
import { eq, desc, and, or, ne, sql } from "drizzle-orm";
import { router, protectedProcedure } from "../index.js";
import { knowledge } from "../../db/schema/index.js";
import {
  generateEmbedding,
  generateQueryEmbedding,
} from "../../ai/embedding-service.js";

export const knowledgeRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          scope: z.enum(["company", "personal"]).optional(),
          category: z.string().optional(),
          search: z.string().optional(),
          limit: z.number().min(1).max(200).default(50),
          offset: z.number().min(0).default(0),
        })
        .optional()
        .default({}),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        // Exclude file-content by default
        ne(knowledge.category, "file-content"),
        // Scope visibility: company entries visible to all, personal only to creator
        or(
          eq(knowledge.scope, "company"),
          and(
            eq(knowledge.scope, "personal"),
            eq(knowledge.createdBy, ctx.session.user.id),
          ),
        )!,
      ];

      if (input.scope) {
        conditions.push(eq(knowledge.scope, input.scope));
      }
      if (input.category) {
        conditions.push(eq(knowledge.category, input.category));
      }

      const rows = await ctx.db
        .select({
          id: knowledge.id,
          scope: knowledge.scope,
          category: knowledge.category,
          title: knowledge.title,
          content: knowledge.content,
          createdBy: knowledge.createdBy,
          createdAt: knowledge.createdAt,
          updatedAt: knowledge.updatedAt,
          sourceFileId: knowledge.sourceFileId,
        })
        .from(knowledge)
        .where(and(...conditions))
        .orderBy(desc(knowledge.updatedAt))
        .limit(input.limit)
        .offset(input.offset);

      return rows;
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [entry] = await ctx.db
        .select({
          id: knowledge.id,
          scope: knowledge.scope,
          category: knowledge.category,
          title: knowledge.title,
          content: knowledge.content,
          createdBy: knowledge.createdBy,
          createdAt: knowledge.createdAt,
          updatedAt: knowledge.updatedAt,
          sourceFileId: knowledge.sourceFileId,
        })
        .from(knowledge)
        .where(eq(knowledge.id, input.id))
        .limit(1);
      return entry ?? null;
    }),

  create: protectedProcedure
    .input(
      z.object({
        scope: z.enum(["company", "personal"]),
        category: z.string().min(1),
        title: z.string().min(1),
        content: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const id = crypto.randomUUID();
      await ctx.db.insert(knowledge).values({
        id,
        scope: input.scope,
        category: input.category,
        title: input.title,
        content: input.content,
        createdBy: ctx.session.user.id,
      });

      // Generate embedding async (don't block on failure)
      generateEmbedding(`${input.title}\n${input.content}`)
        .then(async (emb) => {
          if (emb) {
            const vectorLiteral = sql`'[${sql.raw(emb.join(","))}]'::vector`;
            await ctx.db.execute(
              sql`UPDATE knowledge SET embedding = ${vectorLiteral} WHERE id = ${id}`,
            );
          }
        })
        .catch((err) => {
          console.error("[knowledge] Embedding generation failed for", id, err);
        });

      return { id };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        scope: z.enum(["company", "personal"]).optional(),
        category: z.string().optional(),
        title: z.string().optional(),
        content: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;
      await ctx.db
        .update(knowledge)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(knowledge.id, id));

      // Regenerate embedding if title or content changed
      if (updates.title || updates.content) {
        const [entry] = await ctx.db
          .select({ title: knowledge.title, content: knowledge.content })
          .from(knowledge)
          .where(eq(knowledge.id, id))
          .limit(1);

        if (entry) {
          generateEmbedding(`${entry.title}\n${entry.content}`)
            .then(async (emb) => {
              if (emb) {
                const vectorLiteral = sql`'[${sql.raw(emb.join(","))}]'::vector`;
                await ctx.db.execute(
                  sql`UPDATE knowledge SET embedding = ${vectorLiteral} WHERE id = ${id}`,
                );
              }
            })
            .catch((err) => {
              console.error(
                "[knowledge] Embedding regeneration failed for",
                id,
                err,
              );
            });
        }
      }

      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [entry] = await ctx.db
        .select({
          id: knowledge.id,
          scope: knowledge.scope,
          createdBy: knowledge.createdBy,
        })
        .from(knowledge)
        .where(eq(knowledge.id, input.id))
        .limit(1);

      if (!entry) {
        return { error: "Not found" };
      }

      // ACL: personal entries can only be deleted by creator
      if (
        entry.scope === "personal" &&
        entry.createdBy !== ctx.session.user.id
      ) {
        return { error: "Cannot delete another user's personal knowledge" };
      }

      await ctx.db.delete(knowledge).where(eq(knowledge.id, input.id));
      return { success: true };
    }),

  search: protectedProcedure
    .input(z.object({ query: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const embedding = await generateQueryEmbedding(input.query);

      if (!embedding) {
        // Fall back to text search
        const rows = await ctx.db
          .select({
            id: knowledge.id,
            scope: knowledge.scope,
            category: knowledge.category,
            title: knowledge.title,
            content: knowledge.content,
            createdAt: knowledge.createdAt,
          })
          .from(knowledge)
          .where(
            and(
              ne(knowledge.category, "file-content"),
              or(
                eq(knowledge.scope, "company"),
                and(
                  eq(knowledge.scope, "personal"),
                  eq(knowledge.createdBy, ctx.session.user.id),
                ),
              ),
            ),
          )
          .limit(50);

        const q = input.query.toLowerCase();
        return rows
          .filter(
            (r) =>
              r.title.toLowerCase().includes(q) ||
              r.content.toLowerCase().includes(q),
          )
          .slice(0, 10)
          .map((r) => ({ ...r, similarity: null }));
      }

      const vectorLiteral = sql`'[${sql.raw(embedding.join(","))}]'::vector`;
      const results = await ctx.db.execute(sql`
        SELECT id, scope, category, title, content, created_at,
               1 - (embedding <=> ${vectorLiteral}) as similarity
        FROM knowledge
        WHERE (scope = 'company' OR (scope = 'personal' AND created_by = ${ctx.session.user.id}))
          AND embedding IS NOT NULL
        ORDER BY embedding <=> ${vectorLiteral} ASC
        LIMIT 10
      `);

      return (results.rows ?? results).map((r: any) => ({
        id: r.id,
        scope: r.scope,
        category: r.category,
        title: r.title,
        content: r.content,
        createdAt: r.created_at,
        similarity: r.similarity ? Number(r.similarity) : null,
      }));
    }),

  categories: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .selectDistinct({ category: knowledge.category })
      .from(knowledge)
      .where(ne(knowledge.category, "file-content"));
    return rows.map((r) => r.category);
  }),
});
