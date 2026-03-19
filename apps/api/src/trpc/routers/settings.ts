import { z } from "zod";
import { eq } from "drizzle-orm";
import { router, publicProcedure, protectedProcedure } from "../index.js";
import { entities, settings, conversations, conversationMembers, messages, agents } from "../../db/schema/index.js";
import { users } from "../../db/schema/auth.js";
import { getEntitiesForRoutines } from "@aex/shared";
import { slugify, serializeFields, type EntityField } from "../../db/entity-fields.js";
import { processAIMessage } from "../../ai/agent.js";
import { auth } from "../../auth/index.js";

export const settingsRouter = router({
  isSetupComplete: publicProcedure.query(async ({ ctx }) => {
    const [row] = await ctx.db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, "system.setupComplete"))
      .limit(1);

    return { complete: row?.value === "true" };
  }),

  completeSetup: protectedProcedure
    .input(
      z.object({
        orgName: z.string(),
        orgLogo: z.string().optional(),
        accentColor: z.string().optional(),
        website: z.string().optional(),
        niche: z.string().optional(),
        subNiche: z.string().optional(),
        country: z.string().optional(),
        language: z.string().optional(),
        timezone: z.string().optional(),
        currencies: z.array(z.string()).optional(),
        invites: z.array(z.string()).optional(),
        onboardingPath: z.string().nullable().optional(),
        selectedRoutines: z.array(z.string()).optional(),
        emailProvider: z.enum(['gmail', 'outlook', 'smtp']).nullable().optional(),
        smtpHost: z.string().optional(),
        smtpPort: z.string().optional(),
        smtpUser: z.string().optional(),
        smtpPass: z.string().optional(),
        smtpFrom: z.string().optional(),
        smtpSecure: z.boolean().optional(),
        aiProvider: z.enum(['openai', 'ollama']).nullable().optional(),
        aiApiKey: z.string().optional(),
        aiOllamaModel: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const upsert = async (key: string, value: unknown) => {
        const serialized =
          typeof value === "string" ? value : JSON.stringify(value);
        await ctx.db
          .insert(settings)
          .values({ key, value: serialized })
          .onConflictDoUpdate({
            target: settings.key,
            set: { value: serialized, updatedAt: new Date() },
          });
      };

      // Company settings
      await upsert("company.orgName", input.orgName);
      if (input.orgLogo !== undefined) await upsert("company.orgLogo", input.orgLogo);
      if (input.accentColor !== undefined) await upsert("company.accentColor", input.accentColor);
      if (input.website !== undefined) await upsert("company.website", input.website);
      if (input.niche !== undefined) await upsert("company.niche", input.niche);
      if (input.subNiche !== undefined) await upsert("company.subNiche", input.subNiche);

      // Locale settings
      if (input.country !== undefined) await upsert("locale.country", input.country);
      if (input.language !== undefined) await upsert("locale.language", input.language);
      if (input.timezone !== undefined) await upsert("locale.timezone", input.timezone);
      if (input.currencies !== undefined) await upsert("locale.currencies", input.currencies);

      // Onboarding settings
      if (input.onboardingPath !== undefined) await upsert("onboarding.path", input.onboardingPath);
      if (input.selectedRoutines !== undefined) await upsert("onboarding.selectedRoutines", input.selectedRoutines);
      if (input.invites !== undefined) await upsert("onboarding.pendingInvites", input.invites);

      // Email settings
      if (input.emailProvider !== undefined) await upsert("mail.provider", input.emailProvider);
      if (input.smtpHost) await upsert("mail.smtp.host", input.smtpHost);
      if (input.smtpPort) await upsert("mail.smtp.port", input.smtpPort);
      if (input.smtpUser) await upsert("mail.smtp.user", input.smtpUser);
      if (input.smtpPass) await upsert("mail.smtp.pass", input.smtpPass);
      if (input.smtpFrom) await upsert("mail.smtp.from", input.smtpFrom);
      if (input.smtpSecure !== undefined) await upsert("mail.smtp.secure", input.smtpSecure);

      // AI settings
      if (input.aiProvider !== undefined) await upsert("ai.provider", input.aiProvider);
      if (input.aiApiKey) await upsert("ai.apiKey", input.aiApiKey);
      if (input.aiOllamaModel !== undefined) await upsert("ai.ollamaModel", input.aiOllamaModel);

      // Mark setup as complete
      await upsert("system.setupComplete", "true");

      // Create entities from selected routines (default path)
      if (input.onboardingPath === "default" && input.selectedRoutines && input.selectedRoutines.length > 0) {
        const templates = getEntitiesForRoutines(input.selectedRoutines);
        for (const tpl of templates) {
          const slug = slugify(tpl.name);
          // Skip if entity already exists
          const [existing] = await ctx.db
            .select({ id: entities.id })
            .from(entities)
            .where(eq(entities.slug, slug))
            .limit(1);
          if (existing) continue;

          const fields: EntityField[] = tpl.fields.map((f) => ({
            id: crypto.randomUUID(),
            name: f.name,
            slug: slugify(f.name),
            type: f.type,
            required: f.required ?? false,
            ...(f.options ? { options: f.options } : {}),
          }));

          // Build ai_context: the aiContext + related entities info
          const related = tpl.relatedEntities.length > 0
            ? ` Related entities: ${tpl.relatedEntities.join(", ")}.`
            : "";
          const aiContext = `${tpl.aiContext}${related}`;

          await ctx.db.insert(entities).values({
            id: crypto.randomUUID(),
            name: tpl.name,
            slug,
            description: tpl.description,
            aiContext,
            fields: serializeFields(fields),
            createdBy: ctx.session.user.id,
          });
        }
      }

      // Save company profile from wizard data
      if (input.niche) {
        const companyProfile = {
          name: input.orgName,
          type: input.niche,
          processes: input.selectedRoutines ?? [],
          notes: input.subNiche || undefined,
        };
        await upsert("company_profile", companyProfile);
      }

      // Promote the setup user to owner (first user is always the owner)
      await ctx.db
        .update(users)
        .set({ role: "owner" })
        .where(eq(users.id, ctx.session.user.id));

      // Process pending invites: create users and DM conversations
      if (input.invites && input.invites.length > 0) {
        const validEmails = input.invites.filter((e) => e.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim()));
        for (const email of validEmails) {
          const trimmed = email.trim();
          const namePart = trimmed.split("@")[0].replace(/[._-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
          const tempPassword = crypto.randomUUID().slice(0, 12);

          try {
            const res = await auth.api.signUpEmail({
              body: { name: namePart, email: trimmed, password: tempPassword },
            });

            if (res.user) {
              // Create DM conversation
              const dmId = crypto.randomUUID();
              await ctx.db.insert(conversations).values({
                id: dmId,
                name: namePart,
                type: "dm",
              });
              await ctx.db.insert(conversationMembers).values([
                { conversationId: dmId, userId: ctx.session.user.id },
                { conversationId: dmId, userId: res.user.id },
              ]);
            }
          } catch (err) {
            // Skip if user already exists or creation fails
            console.error(`Failed to invite ${trimmed}:`, err);
          }
        }
      }

      // Create the default Eric agent (every installation gets Eric for free)
      const ericId = crypto.randomUUID();
      await ctx.db.insert(agents).values({
        id: ericId,
        name: "Eric",
        slug: "eric",
        description: "Your AI-powered ERP assistant. Eric helps manage tasks, query data, create entities, and automate workflows.",
        systemPrompt: "",
        isSystem: true,
        createdBy: ctx.session.user.id,
      });

      // Create the default Eric conversation
      const convId = crypto.randomUUID();
      await ctx.db.insert(conversations).values({
        id: convId,
        name: "Eric",
        type: "ai",
        agentId: ericId,
      });
      await ctx.db.insert(conversationMembers).values({
        conversationId: convId,
        userId: ctx.session.user.id,
      });

      // Send a kickoff message so Eric starts researching the company
      const parts: string[] = [];
      parts.push(`I just set up RUN for ${input.orgName}.`);
      if (input.website) parts.push(`Our website is ${input.website}.`);
      if (input.niche) parts.push(`We work in ${input.niche}${input.subNiche ? ` (${input.subNiche})` : ""}.`);
      if (input.selectedRoutines && input.selectedRoutines.length > 0) {
        parts.push(`We selected these routines: ${input.selectedRoutines.join(", ")}.`);
      }
      parts.push("Research our company and introduce yourself. Explain what you can help us with based on our business context.");

      const msgId = crypto.randomUUID();
      await ctx.db.insert(messages).values({
        id: msgId,
        conversationId: convId,
        authorId: ctx.session.user.id,
        content: parts.join(" "),
        role: "user",
      });

      // Trigger AI response asynchronously
      processAIMessage(convId, ctx.session.user.id, ctx.db).catch(
        (err) => console.error("Setup AI kickoff error:", err),
      );

      return { success: true };
    }),

  get: protectedProcedure
    .input(z.object({ key: z.string() }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select({ value: settings.value })
        .from(settings)
        .where(eq(settings.key, input.key))
        .limit(1);

      if (!row) return null;

      try {
        return JSON.parse(row.value);
      } catch {
        return row.value;
      }
    }),

  set: protectedProcedure
    .input(
      z.object({
        key: z.string(),
        value: z.unknown(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const serialized = typeof input.value === "string" ? input.value : JSON.stringify(input.value);

      await ctx.db
        .insert(settings)
        .values({
          key: input.key,
          value: serialized,
        })
        .onConflictDoUpdate({
          target: settings.key,
          set: {
            value: serialized,
            updatedAt: new Date(),
          },
        });

      return { success: true };
    }),
});
