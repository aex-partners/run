import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../index.js";
import { integrations, entityRecords } from "../../db/schema/index.js";
import { buildBlingAuthUrl } from "../../bling/oauth.js";
import { signOAuthState } from "../../utils/oauth-state.js";
import { encryptCredentials } from "../../integrations/crypto.js";
import { enqueueBlingSync } from "../../queue/bling-queue.js";
import { getBlingEntityId, BLING_ENTITY_SLUGS } from "../../bling/entities.js";

export const blingRouter = router({
  getOAuthUrl: protectedProcedure
    .input(z.object({
      clientId: z.string().min(1),
      clientSecret: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      // Encrypt secrets before embedding in state to prevent URL exposure
      const encryptedSecrets = encryptCredentials({
        clientId: input.clientId,
        clientSecret: input.clientSecret,
      });
      const state = signOAuthState({
        provider: "bling",
        userId: ctx.session.user.id,
        secrets: encryptedSecrets,
      });

      const authUrl = buildBlingAuthUrl(input.clientId, state);
      return { authUrl };
    }),

  syncNow: protectedProcedure
    .input(z.object({ integrationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [integration] = await ctx.db
        .select()
        .from(integrations)
        .where(eq(integrations.id, input.integrationId))
        .limit(1);

      if (!integration) throw new TRPCError({ code: "NOT_FOUND" });
      if (integration.status !== "enabled") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Integration is disabled" });
      }

      await enqueueBlingSync(input.integrationId);
      return { queued: true };
    }),

  getSyncStatus: protectedProcedure.query(async ({ ctx }) => {
    // Find bling integration(s)
    const rows = await ctx.db
      .select()
      .from(integrations)
      .where(sql`${integrations.slug} LIKE 'bling-%'`);

    return rows.map((r) => {
      const config = r.config ? JSON.parse(r.config) : {};
      return {
        id: r.id,
        name: r.name,
        status: r.status,
        lastSyncAt: config.lastSyncAt ?? null,
        syncInterval: config.syncInterval ?? null,
      };
    });
  }),

  getEntityCounts: protectedProcedure.query(async ({ ctx }) => {
    const counts: Record<string, number> = {};

    for (const slug of BLING_ENTITY_SLUGS) {
      const entityId = await getBlingEntityId(ctx.db, slug);
      if (!entityId) {
        counts[slug] = 0;
        continue;
      }

      const [result] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(entityRecords)
        .where(eq(entityRecords.entityId, entityId));

      counts[slug] = result?.count ?? 0;
    }

    return counts;
  }),

  disconnect: protectedProcedure
    .input(z.object({ integrationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(integrations)
        .set({ status: "disabled", updatedAt: new Date() })
        .where(eq(integrations.id, input.integrationId));

      return { success: true };
    }),
});
