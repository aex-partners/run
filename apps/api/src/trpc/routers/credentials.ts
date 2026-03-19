import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../index.js";
import {
  createCredential,
  updateCredential,
  deleteCredential,
  getCredentialById,
  getCredentialsByPlugin,
  listCredentials,
} from "../../credentials/credential-service.js";
import { generatePluginAuthUrl } from "../../credentials/oauth2-handler.js";

export const credentialsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await listCredentials(ctx.db);
    // Strip the raw value from list results for security
    return rows.map((r) => ({
      ...r,
      value: undefined,
      hasValue: r.value !== "{}",
    }));
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const cred = await getCredentialById(ctx.db, input.id);
      if (!cred) throw new TRPCError({ code: "NOT_FOUND" });
      return { ...cred, value: undefined, hasValue: cred.value !== "{}" };
    }),

  getByPlugin: protectedProcedure
    .input(z.object({ pluginName: z.string() }))
    .query(async ({ ctx, input }) => {
      const rows = await getCredentialsByPlugin(ctx.db, input.pluginName);
      return rows.map((r) => ({
        ...r,
        value: undefined,
        hasValue: r.value !== "{}",
      }));
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        pluginName: z.string().min(1),
        type: z.enum(["oauth2", "secret_text", "basic_auth", "custom_auth"]),
        value: z.record(z.unknown()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const id = await createCredential(ctx.db, {
        ...input,
        userId: ctx.session.user.id,
      });
      return { id };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        value: z.record(z.unknown()).optional(),
        status: z.enum(["active", "error", "missing"]).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await updateCredential(ctx.db, input);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await deleteCredential(ctx.db, input.id);
      return { success: true };
    }),

  getOAuth2Url: protectedProcedure
    .input(
      z.object({
        pluginName: z.string(),
        clientId: z.string(),
        clientSecret: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Load OAuth2 config from catalog
      const { default: catalog } = await import("../../../data/piece-catalog.json", {
        with: { type: "json" },
      });
      const entry = (catalog as Array<{ pieceName: string; auth: { type: string; authUrl?: string; tokenUrl?: string; scope?: string[] } }>)
        .find((e) => e.pieceName === input.pluginName);

      if (!entry?.auth || entry.auth.type !== "oauth2" || !entry.auth.authUrl || !entry.auth.tokenUrl) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Plugin does not support OAuth2" });
      }

      const baseUrl = process.env.BETTER_AUTH_URL || "http://localhost:3001";
      const url = generatePluginAuthUrl({
        pluginName: input.pluginName,
        oauthConfig: {
          authUrl: entry.auth.authUrl,
          tokenUrl: entry.auth.tokenUrl,
          scope: entry.auth.scope,
        },
        clientId: input.clientId,
        clientSecret: input.clientSecret,
        userId: ctx.session.user.id,
        baseUrl,
      });

      return { url };
    }),
});
