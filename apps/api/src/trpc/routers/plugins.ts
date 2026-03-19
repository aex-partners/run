import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../index.js";
import { plugins } from "../../db/schema/index.js";
import {
  installPlugin,
  uninstallPlugin,
  configurePlugin,
  setPluginStatus,
} from "../../plugins/plugin-service.js";
import { syncRegistry } from "../../plugins/registry.js";

export const pluginsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.select().from(plugins);
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [plugin] = await ctx.db
        .select()
        .from(plugins)
        .where(eq(plugins.id, input.id))
        .limit(1);
      return plugin ?? null;
    }),

  install: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await installPlugin(ctx.db, input.id, ctx.session.user.id);
        return { success: true };
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err instanceof Error ? err.message : "Install failed",
        });
      }
    }),

  uninstall: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await uninstallPlugin(ctx.db, input.id);
        return { success: true };
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: err instanceof Error ? err.message : "Uninstall failed",
        });
      }
    }),

  configure: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        config: z.record(z.unknown()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await configurePlugin(ctx.db, input.id, input.config);
      return { success: true };
    }),

  setEnabled: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        enabled: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await setPluginStatus(ctx.db, input.id, input.enabled);
        return { success: true };
      } catch (err) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: err instanceof Error ? err.message : "Toggle failed",
        });
      }
    }),

  syncRegistry: protectedProcedure.mutation(async ({ ctx }) => {
    const count = await syncRegistry(ctx.db);
    return { synced: count };
  }),

  getConfigSchema: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [plugin] = await ctx.db
        .select()
        .from(plugins)
        .where(eq(plugins.id, input.id))
        .limit(1);

      if (!plugin) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      const manifest = JSON.parse(plugin.manifest);
      return manifest.configSchema ?? null;
    }),
});
