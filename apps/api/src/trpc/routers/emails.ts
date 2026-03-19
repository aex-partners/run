import { z } from "zod";
import { eq, desc, and, sql, ilike, or } from "drizzle-orm";
import { router, protectedProcedure } from "../index.js";
import { emailAccounts, emails, emailAttachments, emailLabels, integrations } from "../../db/schema/index.js";
import { broadcast } from "../../ws/index.js";
import { generateAuthUrl } from "../../integrations/oauth.js";
import { encryptCredentials, decryptCredentials } from "../../integrations/crypto.js";

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
];

const OUTLOOK_SCOPES = [
  "https://graph.microsoft.com/Mail.ReadWrite",
  "https://graph.microsoft.com/Mail.Send",
  "offline_access",
];

function getOAuthConfig(provider: "gmail" | "outlook") {
  if (provider === "gmail") {
    return {
      authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      clientId: process.env.GMAIL_CLIENT_ID || "",
      clientSecret: process.env.GMAIL_CLIENT_SECRET || "",
      scopes: GMAIL_SCOPES,
      redirectUri: `${process.env.APP_URL || "http://localhost:3000"}/api/auth/email/callback`,
    };
  }
  return {
    authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    clientId: process.env.OUTLOOK_CLIENT_ID || "",
    clientSecret: process.env.OUTLOOK_CLIENT_SECRET || "",
    scopes: OUTLOOK_SCOPES,
    redirectUri: `${process.env.APP_URL || "http://localhost:3000"}/api/auth/email/callback`,
  };
}

export const emailsRouter = router({
  accounts: router({
    list: protectedProcedure
      .query(async ({ ctx }) => {
        return ctx.db
          .select()
          .from(emailAccounts)
          .where(eq(emailAccounts.ownerId, ctx.session.user.id));
      }),

    connect: protectedProcedure
      .input(z.object({
        provider: z.enum(["gmail", "outlook"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const config = getOAuthConfig(input.provider);
        const state = Buffer.from(JSON.stringify({
          provider: input.provider,
          userId: ctx.session.user.id,
        })).toString("base64url");

        const authUrl = generateAuthUrl(config, state);
        // Add access_type=offline for Gmail to get refresh token
        const finalUrl = input.provider === "gmail"
          ? `${authUrl}&access_type=offline&prompt=consent`
          : authUrl;

        return { authUrl: finalUrl };
      }),

    disconnect: protectedProcedure
      .input(z.object({ accountId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const [account] = await ctx.db
          .select()
          .from(emailAccounts)
          .where(eq(emailAccounts.id, input.accountId))
          .limit(1);
        if (!account) return { error: "Account not found" };

        // Delete emails, labels, and account
        await ctx.db.delete(emailAccounts).where(eq(emailAccounts.id, input.accountId));
        // Delete linked integration
        await ctx.db.delete(integrations).where(eq(integrations.id, account.integrationId));

        broadcast({ type: "email_account_disconnected", accountId: input.accountId });
        return { success: true };
      }),

    sync: protectedProcedure
      .input(z.object({ accountId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const { enqueueEmailSync } = await import("../../queue/email-queue.js");
        await enqueueEmailSync(input.accountId);
        return { queued: true };
      }),
  }),

  list: protectedProcedure
    .input(
      z.object({
        accountId: z.string().optional(),
        folder: z.enum(["inbox", "sent", "drafts", "spam", "trash", "starred"]).optional().default("inbox"),
        search: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }).optional().default({}),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [];

      if (input.accountId) {
        conditions.push(eq(emails.accountId, input.accountId));
      } else {
        // Get all accounts for current user
        const accounts = await ctx.db
          .select({ id: emailAccounts.id })
          .from(emailAccounts)
          .where(eq(emailAccounts.ownerId, ctx.session.user.id));
        if (accounts.length === 0) return [];
        const accountIds = accounts.map((a) => a.id);
        conditions.push(sql`${emails.accountId} IN (${sql.join(accountIds.map(id => sql`${id}`), sql`, `)})`);
      }

      if (input.folder === "starred") {
        conditions.push(eq(emails.starred, 1));
      } else {
        conditions.push(eq(emails.folder, input.folder));
      }

      if (input.search) {
        conditions.push(
          or(
            ilike(emails.subject, `%${input.search}%`),
            ilike(emails.fromName, `%${input.search}%`),
            ilike(emails.preview, `%${input.search}%`),
          )!,
        );
      }

      const where = conditions.length === 1 ? conditions[0] : and(...conditions);

      const rows = await ctx.db
        .select()
        .from(emails)
        .where(where)
        .orderBy(desc(emails.date))
        .limit(input.limit)
        .offset(input.offset);

      return rows.map((row) => ({
        id: row.id,
        from: row.fromName,
        fromEmail: row.fromEmail,
        subject: row.subject,
        preview: row.preview,
        timestamp: formatEmailDate(row.date),
        read: row.read === 1,
        starred: row.starred === 1,
        hasAttachment: row.hasAttachment === 1,
        labels: safeParseJson(row.labels),
        folder: row.folder,
        aiSummary: row.aiSummary,
        aiDraft: row.aiDraft,
      }));
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const [email] = await ctx.db
        .select()
        .from(emails)
        .where(eq(emails.id, input.id))
        .limit(1);
      if (!email) return null;

      const attachments = await ctx.db
        .select()
        .from(emailAttachments)
        .where(eq(emailAttachments.emailId, input.id));

      // Mark as read
      if (email.read === 0) {
        await ctx.db
          .update(emails)
          .set({ read: 1 })
          .where(eq(emails.id, input.id));
      }

      return {
        ...email,
        to: safeParseJson(email.to),
        cc: safeParseJson(email.cc),
        labels: safeParseJson(email.labels),
        read: true,
        starred: email.starred === 1,
        hasAttachment: email.hasAttachment === 1,
        attachments,
      };
    }),

  getThread: protectedProcedure
    .input(z.object({ threadId: z.string() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(emails)
        .where(eq(emails.threadId, input.threadId))
        .orderBy(emails.date);

      return rows.map((row) => ({
        id: row.id,
        from: row.fromName,
        fromEmail: row.fromEmail,
        subject: row.subject,
        bodyHtml: row.bodyHtml,
        bodyText: row.bodyText,
        date: row.date,
        to: safeParseJson(row.to),
        cc: safeParseJson(row.cc),
      }));
    }),

  send: protectedProcedure
    .input(z.object({
      accountId: z.string(),
      to: z.string(),
      cc: z.string().optional(),
      subject: z.string(),
      body: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [account] = await ctx.db
        .select()
        .from(emailAccounts)
        .where(eq(emailAccounts.id, input.accountId))
        .limit(1);
      if (!account) return { error: "Account not found" };

      const [integration] = await ctx.db
        .select()
        .from(integrations)
        .where(eq(integrations.id, account.integrationId))
        .limit(1);
      if (!integration) return { error: "Integration not found" };

      const credentials = decryptCredentials(integration.credentials);
      const { getProvider } = await import("../../email/provider.js");
      const provider = getProvider(account.provider);

      const toAddresses = input.to.split(",").map((e) => e.trim()).filter(Boolean);
      const ccAddresses = input.cc ? input.cc.split(",").map((e) => e.trim()).filter(Boolean) : [];

      const result = await provider.sendMessage(credentials.accessToken as string, {
        from: account.emailAddress,
        fromName: account.displayName || undefined,
        to: toAddresses,
        cc: ccAddresses,
        subject: input.subject,
        bodyHtml: input.body,
      });

      // Store in sent folder locally
      const emailId = crypto.randomUUID();
      await ctx.db.insert(emails).values({
        id: emailId,
        accountId: account.id,
        externalId: result.id || emailId,
        fromName: account.displayName || account.emailAddress,
        fromEmail: account.emailAddress,
        to: JSON.stringify(toAddresses),
        cc: JSON.stringify(ccAddresses),
        subject: input.subject,
        preview: input.body.slice(0, 200).replace(/<[^>]+>/g, ""),
        bodyHtml: input.body,
        folder: "sent",
        read: 1,
        date: new Date(),
      });

      broadcast({ type: "email_sent" });
      return { success: true, id: emailId };
    }),

  reply: protectedProcedure
    .input(z.object({
      emailId: z.string(),
      body: z.string(),
      replyAll: z.boolean().optional().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const [original] = await ctx.db
        .select()
        .from(emails)
        .where(eq(emails.id, input.emailId))
        .limit(1);
      if (!original) return { error: "Email not found" };

      const [account] = await ctx.db
        .select()
        .from(emailAccounts)
        .where(eq(emailAccounts.id, original.accountId))
        .limit(1);
      if (!account) return { error: "Account not found" };

      const [integration] = await ctx.db
        .select()
        .from(integrations)
        .where(eq(integrations.id, account.integrationId))
        .limit(1);
      if (!integration) return { error: "Integration not found" };

      const credentials = decryptCredentials(integration.credentials);
      const { getProvider } = await import("../../email/provider.js");
      const provider = getProvider(account.provider);

      const toAddresses = [original.fromEmail];
      const ccAddresses = input.replyAll ? safeParseJson(original.cc) as string[] : [];

      await provider.sendMessage(credentials.accessToken as string, {
        from: account.emailAddress,
        fromName: account.displayName || undefined,
        to: toAddresses,
        cc: ccAddresses,
        subject: `Re: ${original.subject}`,
        bodyHtml: input.body,
        inReplyTo: original.externalId,
      });

      broadcast({ type: "email_sent" });
      return { success: true };
    }),

  star: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [email] = await ctx.db
        .select({ starred: emails.starred })
        .from(emails)
        .where(eq(emails.id, input.id))
        .limit(1);
      if (!email) return { error: "Email not found" };

      const newStarred = email.starred === 1 ? 0 : 1;
      await ctx.db
        .update(emails)
        .set({ starred: newStarred })
        .where(eq(emails.id, input.id));
      return { starred: newStarred === 1 };
    }),

  markRead: protectedProcedure
    .input(z.object({ ids: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      for (const id of input.ids) {
        await ctx.db.update(emails).set({ read: 1 }).where(eq(emails.id, id));
      }
      return { success: true };
    }),

  markUnread: protectedProcedure
    .input(z.object({ ids: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      for (const id of input.ids) {
        await ctx.db.update(emails).set({ read: 0 }).where(eq(emails.id, id));
      }
      return { success: true };
    }),

  archive: protectedProcedure
    .input(z.object({ ids: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      for (const id of input.ids) {
        await ctx.db.delete(emails).where(eq(emails.id, id));
      }
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ ids: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      for (const id of input.ids) {
        await ctx.db
          .update(emails)
          .set({ folder: "trash" })
          .where(eq(emails.id, id));
      }
      return { success: true };
    }),

  folderCounts: protectedProcedure
    .input(z.object({ accountId: z.string().optional() }).optional().default({}))
    .query(async ({ ctx, input }) => {
      let accountFilter = sql`1=1`;
      if (input.accountId) {
        accountFilter = eq(emails.accountId, input.accountId);
      } else {
        const accounts = await ctx.db
          .select({ id: emailAccounts.id })
          .from(emailAccounts)
          .where(eq(emailAccounts.ownerId, ctx.session.user.id));
        if (accounts.length === 0) return { inbox: 0, sent: 0, drafts: 0, spam: 0, trash: 0, starred: 0 };
        const ids = accounts.map((a) => a.id);
        accountFilter = sql`${emails.accountId} IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})`;
      }

      const [result] = await ctx.db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE folder = 'inbox' AND read = 0) as inbox,
          COUNT(*) FILTER (WHERE folder = 'sent') as sent,
          COUNT(*) FILTER (WHERE folder = 'drafts') as drafts,
          COUNT(*) FILTER (WHERE folder = 'spam') as spam,
          COUNT(*) FILTER (WHERE folder = 'trash') as trash,
          COUNT(*) FILTER (WHERE starred = 1) as starred
        FROM emails
        WHERE ${accountFilter}
      `);

      return {
        inbox: Number(result.inbox) || 0,
        sent: Number(result.sent) || 0,
        drafts: Number(result.drafts) || 0,
        spam: Number(result.spam) || 0,
        trash: Number(result.trash) || 0,
        starred: Number(result.starred) || 0,
      };
    }),

  labels: router({
    list: protectedProcedure
      .input(z.object({ accountId: z.string() }))
      .query(async ({ ctx, input }) => {
        return ctx.db
          .select()
          .from(emailLabels)
          .where(eq(emailLabels.accountId, input.accountId));
      }),

    create: protectedProcedure
      .input(z.object({
        accountId: z.string(),
        name: z.string(),
        color: z.string().default("#6b7280"),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = crypto.randomUUID();
        const [label] = await ctx.db
          .insert(emailLabels)
          .values({ id, accountId: input.accountId, name: input.name, color: input.color })
          .returning();
        return label;
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await ctx.db.delete(emailLabels).where(eq(emailLabels.id, input.id));
        return { success: true };
      }),
  }),

  aiSummary: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [email] = await ctx.db
        .select()
        .from(emails)
        .where(eq(emails.id, input.id))
        .limit(1);
      if (!email) return { error: "Email not found" };

      const bodyText = email.bodyText || email.bodyHtml?.replace(/<[^>]+>/g, "") || "";
      const { generateText } = await import("ai");
      const { createAnthropic } = await import("@ai-sdk/anthropic");

      const anthropic = createAnthropic();
      const result = await generateText({
        model: anthropic("claude-sonnet-4-20250514"),
        prompt: `Summarize this email in 2-3 sentences:\n\nFrom: ${email.fromName} <${email.fromEmail}>\nSubject: ${email.subject}\n\n${bodyText.slice(0, 4000)}`,
      });

      await ctx.db
        .update(emails)
        .set({ aiSummary: result.text })
        .where(eq(emails.id, input.id));

      return { summary: result.text };
    }),

  aiDraft: protectedProcedure
    .input(z.object({ id: z.string(), prompt: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const [email] = await ctx.db
        .select()
        .from(emails)
        .where(eq(emails.id, input.id))
        .limit(1);
      if (!email) return { error: "Email not found" };

      const bodyText = email.bodyText || email.bodyHtml?.replace(/<[^>]+>/g, "") || "";
      const { generateText } = await import("ai");
      const { createAnthropic } = await import("@ai-sdk/anthropic");

      const anthropic = createAnthropic();
      const userPrompt = input.prompt
        ? `Draft a reply to this email following these instructions: ${input.prompt}\n\nOriginal email:\nFrom: ${email.fromName}\nSubject: ${email.subject}\n\n${bodyText.slice(0, 4000)}`
        : `Draft a professional reply to this email:\n\nFrom: ${email.fromName}\nSubject: ${email.subject}\n\n${bodyText.slice(0, 4000)}`;

      const result = await generateText({
        model: anthropic("claude-sonnet-4-20250514"),
        prompt: userPrompt,
      });

      await ctx.db
        .update(emails)
        .set({ aiDraft: result.text })
        .where(eq(emails.id, input.id));

      return { draft: result.text };
    }),
});

function formatEmailDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) {
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) {
    return date.toLocaleDateString("en-US", { weekday: "short" });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function safeParseJson(str: string): unknown[] {
  try {
    return JSON.parse(str);
  } catch {
    return [];
  }
}
