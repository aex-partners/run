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
import { syncPieceCatalog } from "../../plugins/piece-registry.js";
import { loadPiece } from "../../plugins/piece-loader.js";

export const pluginsRouter = router({
  catalog: protectedProcedure.query(async () => {
    const { default: catalog } = await import("../../../data/piece-catalog.json", {
      with: { type: "json" },
    });
    return catalog;
  }),

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
    const manifestCount = await syncRegistry(ctx.db);
    const pieceCount = await syncPieceCatalog(ctx.db);
    return { synced: manifestCount + pieceCount };
  }),

  listPieceTools: protectedProcedure.query(async ({ ctx }) => {
    const installedPieces = await ctx.db
      .select()
      .from(plugins)
      .where(eq(plugins.status, "installed"));

    const tools: Array<{
      name: string;
      displayName: string;
      description: string;
      pluginName: string;
      pluginDisplayName: string;
      pluginLogoUrl: string | null;
    }> = [];

    for (const plugin of installedPieces) {
      if (!plugin.pieceName) continue;

      try {
        const piece = await loadPiece(plugin.pieceName);
        if (!piece) continue;

        const actions = piece.actions();
        for (const [actionName, action] of Object.entries(actions)) {
          const a = action as { displayName?: string; description?: string };
          tools.push({
            name: `${plugin.pieceName}:${actionName}`,
            displayName: a.displayName ?? actionName,
            description: a.description ?? "",
            pluginName: plugin.name,
            pluginDisplayName: plugin.name,
            pluginLogoUrl: plugin.icon?.startsWith("http") ? plugin.icon : null,
          });
        }
      } catch {
        // Piece not loadable (not installed yet or error)
      }
    }

    return tools;
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

      if (!plugin.manifest) return null;
      const manifest = JSON.parse(plugin.manifest);
      return manifest.configSchema ?? null;
    }),
});
