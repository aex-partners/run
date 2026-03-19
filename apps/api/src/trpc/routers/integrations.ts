import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../index.js";
import { integrations, customTools } from "../../db/schema/index.js";
import { slugify } from "../../db/entity-fields.js";
import { encryptCredentials, decryptCredentials } from "../../integrations/crypto.js";
import { generateAuthUrl } from "../../integrations/oauth.js";

const integrationInput = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(["rest", "oauth2", "webhook"]),
  config: z.record(z.unknown()).default({}),
  credentials: z.record(z.unknown()).default({}),
  webhookSecret: z.string().optional(),
});

export const integrationsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.select().from(integrations);
    // Don't return raw credentials
    return rows.map((r) => ({
      ...r,
      credentials: "***",
    }));
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select()
        .from(integrations)
        .where(eq(integrations.id, input.id))
        .limit(1);
      if (!row) return null;
      return {
        ...row,
        credentials: "***",
      };
    }),

  create: protectedProcedure
    .input(integrationInput)
    .mutation(async ({ ctx, input }) => {
      const id = crypto.randomUUID();
      const slug = slugify(input.name);
      const encryptedCreds = encryptCredentials(input.credentials);

      const [created] = await ctx.db
        .insert(integrations)
        .values({
          id,
          name: input.name,
          slug,
          description: input.description ?? null,
          type: input.type,
          config: JSON.stringify(input.config),
          credentials: encryptedCreds,
          webhookSecret: input.webhookSecret ?? null,
          createdBy: ctx.session.user.id,
        })
        .returning();

      return { ...created, credentials: "***" };
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string() }).merge(integrationInput.partial()))
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;
      const setValues: Record<string, unknown> = { updatedAt: new Date() };

      if (updates.name !== undefined) {
        setValues.name = updates.name;
        setValues.slug = slugify(updates.name);
      }
      if (updates.description !== undefined) setValues.description = updates.description;
      if (updates.type !== undefined) setValues.type = updates.type;
      if (updates.config !== undefined) setValues.config = JSON.stringify(updates.config);
      if (updates.credentials !== undefined) {
        setValues.credentials = encryptCredentials(updates.credentials);
      }
      if (updates.webhookSecret !== undefined) setValues.webhookSecret = updates.webhookSecret;

      const [updated] = await ctx.db
        .update(integrations)
        .set(setValues)
        .where(eq(integrations.id, id))
        .returning();

      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return { ...updated, credentials: "***" };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Remove associated custom tools
      await ctx.db.delete(customTools).where(eq(customTools.integrationId, input.id));
      await ctx.db.delete(integrations).where(eq(integrations.id, input.id));
      return { success: true };
    }),

  enable: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(integrations)
        .set({ status: "enabled", updatedAt: new Date() })
        .where(eq(integrations.id, input.id))
        .returning();

      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return { ...updated, credentials: "***" };
    }),

  disable: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await ctx.db
        .update(integrations)
        .set({ status: "disabled", updatedAt: new Date() })
        .where(eq(integrations.id, input.id))
        .returning();

      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return { ...updated, credentials: "***" };
    }),

  getOAuthUrl: protectedProcedure
    .input(z.object({ id: z.string(), redirectUri: z.string().url() }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select()
        .from(integrations)
        .where(eq(integrations.id, input.id))
        .limit(1);

      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      if (row.type !== "oauth2") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Not an OAuth2 integration" });
      }

      const config = JSON.parse(row.config) as Record<string, unknown>;
      const creds = decryptCredentials(row.credentials);

      const state = crypto.randomUUID();
      const authUrl = generateAuthUrl(
        {
          authUrl: config.authUrl as string,
          tokenUrl: config.tokenUrl as string,
          clientId: creds.clientId as string,
          clientSecret: creds.clientSecret as string,
          scopes: config.scopes as string[] | undefined,
          redirectUri: input.redirectUri,
        },
        state,
      );

      return { authUrl, state };
    }),

  getDecryptedCredentials: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select({ credentials: integrations.credentials })
        .from(integrations)
        .where(eq(integrations.id, input.id))
        .limit(1);

      if (!row) throw new TRPCError({ code: "NOT_FOUND" });
      return decryptCredentials(row.credentials);
    }),
});
