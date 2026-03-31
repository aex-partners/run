import { z } from "zod";
import { eq, desc, and, sql, ilike, or, inArray } from "drizzle-orm";
import Anthropic from "@anthropic-ai/sdk";
import { router, protectedProcedure } from "../index.js";
import { emails, emailAttachments, emailLabels, emailAccounts, mailAccountMembers } from "../../db/schema/index.js";
import { broadcast } from "../../ws/index.js";

/** Get IDs of accounts the user can access. Cached per-request via closure. */
async function getUserAccountIds(db: Parameters<typeof eq>[0] extends never ? never : any, userId: string): Promise<string[]> {
  const { getAccessibleAccountsForUser } = await import("../../email/provider.js");
  const accounts = await getAccessibleAccountsForUser(db, userId);
  return accounts.map((a) => a.id);
}

/** Verify an email belongs to one of the user's accounts. Returns the email row or null. */
async function verifyEmailAccess(db: any, emailId: string, accountIds: string[]) {
  if (accountIds.length === 0) return null;
  const [email] = await db
    .select()
    .from(emails)
    .where(
      and(
        eq(emails.id, emailId),
        inArray(emails.accountId, accountIds),
      ),
    )
    .limit(1);
  return email ?? null;
}

export const emailsRouter = router({
  /** Check if the current user has at least one mail account. */
  isConfigured: protectedProcedure
    .query(async ({ ctx }) => {
      const ids = await getUserAccountIds(ctx.db, ctx.session.user.id);
      return { configured: ids.length > 0 };
    }),

  // ---------------------------------------------------------------------------
  // Mail accounts sub-router
  // ---------------------------------------------------------------------------

  mailAccounts: router({
    /** List all mail accounts the current user has access to (owned + shared). */
    list: protectedProcedure
      .query(async ({ ctx }) => {
        const { getAccessibleAccountsForUser } = await import("../../email/provider.js");
        const accounts = await getAccessibleAccountsForUser(ctx.db, ctx.session.user.id);
        return accounts.map((a) => ({
          id: a.id,
          displayName: a.displayName,
          emailAddress: a.emailAddress,
          fromName: a.fromName,
          smtpHost: a.smtpHost,
          smtpPort: a.smtpPort,
          smtpSecure: a.smtpSecure === 1,
          isShared: a.isShared === 1,
          isOwner: a.ownerId === ctx.session.user.id,
        }));
      }),

    /** Get server-level SMTP defaults (for pre-filling forms). */
    getDefaults: protectedProcedure
      .query(async ({ ctx }) => {
        const { getSmtpDefaults } = await import("../../email/provider.js");
        return await getSmtpDefaults(ctx.db);
      }),

    /** Auto-discover SMTP/IMAP settings from email address. */
    autodiscover: protectedProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ input }) => {
        const { autodiscover } = await import("../../email/autodiscover.js");
        const settings = await autodiscover(input.email);
        return settings;
      }),

    /** Create a new mail account for the current user. */
    create: protectedProcedure
      .input(z.object({
        displayName: z.string().min(1),
        emailAddress: z.string().email(),
        fromName: z.string().optional(),
        smtpHost: z.string().min(1),
        smtpPort: z.number().int().min(1).max(65535).default(587),
        smtpUser: z.string().min(1),
        smtpPass: z.string().min(1),
        smtpSecure: z.boolean().default(true),
        imapHost: z.string().optional(),
        imapPort: z.number().int().min(1).max(65535).default(993),
        imapUser: z.string().optional(),
        imapPass: z.string().optional(),
        imapSecure: z.boolean().default(true),
        isShared: z.boolean().default(false),
      }))
      .mutation(async ({ ctx, input }) => {
        const accountId = crypto.randomUUID();

        await ctx.db.insert(emailAccounts).values({
          id: accountId,
          displayName: input.displayName,
          emailAddress: input.emailAddress,
          fromName: input.fromName || null,
          smtpHost: input.smtpHost,
          smtpPort: input.smtpPort,
          smtpUser: input.smtpUser,
          smtpPass: input.smtpPass,
          smtpSecure: input.smtpSecure ? 1 : 0,
          imapHost: input.imapHost || null,
          imapPort: input.imapPort,
          imapUser: input.imapUser || null,
          imapPass: input.imapPass || null,
          imapSecure: input.imapSecure ? 1 : 0,
          isShared: input.isShared ? 1 : 0,
          ownerId: ctx.session.user.id,
        });

        await ctx.db.insert(mailAccountMembers).values({
          accountId,
          userId: ctx.session.user.id,
          canSend: 1,
        });

        // Trigger IMAP sync in background if IMAP is configured
        if (input.imapHost) {
          const { syncImapAccount } = await import("../../email/sync.js");
          syncImapAccount(ctx.db, accountId).catch((err) => {
            console.error(`[email-sync] Initial sync failed for ${accountId}:`, err);
          });
        }

        return { id: accountId };
      }),

    /** Update a mail account (owner only). */
    update: protectedProcedure
      .input(z.object({
        id: z.string(),
        displayName: z.string().min(1).optional(),
        emailAddress: z.string().email().optional(),
        fromName: z.string().optional(),
        smtpHost: z.string().min(1).optional(),
        smtpPort: z.number().int().min(1).max(65535).optional(),
        smtpUser: z.string().min(1).optional(),
        smtpPass: z.string().min(1).optional(),
        smtpSecure: z.boolean().optional(),
        isShared: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const [account] = await ctx.db
          .select({ ownerId: emailAccounts.ownerId })
          .from(emailAccounts)
          .where(eq(emailAccounts.id, input.id))
          .limit(1);
        if (!account) return { error: "Account not found" };
        if (account.ownerId !== ctx.session.user.id) return { error: "Only the account owner can edit it" };

        const { id, ...updates } = input;
        const setValues: Record<string, unknown> = { updatedAt: new Date() };
        if (updates.displayName !== undefined) setValues.displayName = updates.displayName;
        if (updates.emailAddress !== undefined) setValues.emailAddress = updates.emailAddress;
        if (updates.fromName !== undefined) setValues.fromName = updates.fromName || null;
        if (updates.smtpHost !== undefined) setValues.smtpHost = updates.smtpHost;
        if (updates.smtpPort !== undefined) setValues.smtpPort = updates.smtpPort;
        if (updates.smtpUser !== undefined) setValues.smtpUser = updates.smtpUser;
        if (updates.smtpPass !== undefined) setValues.smtpPass = updates.smtpPass;
        if (updates.smtpSecure !== undefined) setValues.smtpSecure = updates.smtpSecure ? 1 : 0;
        if (updates.isShared !== undefined) setValues.isShared = updates.isShared ? 1 : 0;

        await ctx.db.update(emailAccounts).set(setValues).where(eq(emailAccounts.id, id));
        return { success: true };
      }),

    /** Delete a mail account (owner only). Cascades to emails and members. */
    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const [account] = await ctx.db
          .select({ ownerId: emailAccounts.ownerId })
          .from(emailAccounts)
          .where(eq(emailAccounts.id, input.id))
          .limit(1);
        if (!account) return { error: "Account not found" };
        if (account.ownerId !== ctx.session.user.id) return { error: "Only the account owner can delete it" };

        await ctx.db.delete(emailAccounts).where(eq(emailAccounts.id, input.id));
        return { success: true };
      }),

    /** Add a user as member of a shared mail account. */
    addMember: protectedProcedure
      .input(z.object({
        accountId: z.string(),
        userId: z.string(),
        canSend: z.boolean().default(true),
      }))
      .mutation(async ({ ctx, input }) => {
        const [account] = await ctx.db
          .select({ ownerId: emailAccounts.ownerId, isShared: emailAccounts.isShared })
          .from(emailAccounts)
          .where(eq(emailAccounts.id, input.accountId))
          .limit(1);
        if (!account) return { error: "Account not found" };
        if (account.ownerId !== ctx.session.user.id) return { error: "Only the account owner can manage members" };
        if (account.isShared !== 1) return { error: "Account is not shared" };

        await ctx.db
          .insert(mailAccountMembers)
          .values({
            accountId: input.accountId,
            userId: input.userId,
            canSend: input.canSend ? 1 : 0,
          })
          .onConflictDoUpdate({
            target: [mailAccountMembers.accountId, mailAccountMembers.userId],
            set: { canSend: input.canSend ? 1 : 0 },
          });

        return { success: true };
      }),

    /** Remove a user from a shared mail account. */
    removeMember: protectedProcedure
      .input(z.object({
        accountId: z.string(),
        userId: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const [account] = await ctx.db
          .select({ ownerId: emailAccounts.ownerId })
          .from(emailAccounts)
          .where(eq(emailAccounts.id, input.accountId))
          .limit(1);
        if (!account) return { error: "Account not found" };
        if (account.ownerId !== ctx.session.user.id) return { error: "Only the account owner can manage members" };
        if (input.userId === account.ownerId) return { error: "Cannot remove the owner from the account" };

        await ctx.db
          .delete(mailAccountMembers)
          .where(
            and(
              eq(mailAccountMembers.accountId, input.accountId),
              eq(mailAccountMembers.userId, input.userId),
            ),
          );
        return { success: true };
      }),

    /** Verify SMTP connection for given credentials. */
    verify: protectedProcedure
      .input(z.object({
        host: z.string(),
        port: z.number(),
        user: z.string(),
        pass: z.string(),
        from: z.string(),
        secure: z.boolean(),
      }))
      .mutation(async ({ input }) => {
        const { verifySmtpConfig } = await import("../../email/provider.js");
        return verifySmtpConfig(input);
      }),

    /** Verify IMAP connection for given credentials. */
    verifyImap: protectedProcedure
      .input(z.object({
        host: z.string(),
        port: z.number(),
        user: z.string(),
        pass: z.string(),
        secure: z.boolean(),
      }))
      .mutation(async ({ input }) => {
        const { verifyImapConfig } = await import("../../email/sync.js");
        return verifyImapConfig(input);
      }),
  }),

  /** Trigger IMAP sync for an account. */
  sync: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const accountIds = await getUserAccountIds(ctx.db, ctx.session.user.id);
      if (!accountIds.includes(input.accountId)) return { error: "Account not found" };

      const { syncImapAccount } = await import("../../email/sync.js");
      const result = await syncImapAccount(ctx.db, input.accountId);
      return { success: true, fetched: result.fetched, errors: result.errors };
    }),

  // ---------------------------------------------------------------------------
  // Send / Reply
  // ---------------------------------------------------------------------------

  /** Send an email from a specific mail account. */
  send: protectedProcedure
    .input(z.object({
      accountId: z.string(),
      to: z.string(),
      cc: z.string().optional(),
      subject: z.string(),
      body: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { userCanSendFrom, sendMailFromAccount, getAccountSmtpConfig } = await import("../../email/provider.js");
      const { storeSentEmail } = await import("../../email/sync.js");

      const canSend = await userCanSendFrom(ctx.db, ctx.session.user.id, input.accountId);
      if (!canSend) return { error: "You don't have permission to send from this account." };

      const config = await getAccountSmtpConfig(ctx.db, input.accountId);
      if (!config) return { error: "Mail account not found." };

      const toAddresses = input.to.split(",").map((e) => e.trim()).filter(Boolean);
      const ccAddresses = input.cc ? input.cc.split(",").map((e) => e.trim()).filter(Boolean) : [];

      const result = await sendMailFromAccount(ctx.db, input.accountId, {
        to: toAddresses,
        cc: ccAddresses,
        subject: input.subject,
        bodyHtml: input.body,
      });

      const emailId = await storeSentEmail(ctx.db, {
        accountId: input.accountId,
        fromName: config.fromName || config.from,
        fromEmail: config.from,
        to: toAddresses,
        cc: ccAddresses,
        subject: input.subject,
        bodyHtml: input.body,
        messageId: result.messageId,
      });

      broadcast({ type: "email_sent" });
      return { success: true, id: emailId };
    }),

  /** Reply to an email from a specific mail account. */
  reply: protectedProcedure
    .input(z.object({
      accountId: z.string(),
      emailId: z.string(),
      body: z.string(),
      replyAll: z.boolean().optional().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const accountIds = await getUserAccountIds(ctx.db, ctx.session.user.id);
      const original = await verifyEmailAccess(ctx.db, input.emailId, accountIds);
      if (!original) return { error: "Email not found" };

      const { userCanSendFrom, sendMailFromAccount, getAccountSmtpConfig } = await import("../../email/provider.js");
      const { storeSentEmail } = await import("../../email/sync.js");

      const canSend = await userCanSendFrom(ctx.db, ctx.session.user.id, input.accountId);
      if (!canSend) return { error: "You don't have permission to send from this account." };

      const config = await getAccountSmtpConfig(ctx.db, input.accountId);
      if (!config) return { error: "Mail account not found." };

      const toAddresses = [original.fromEmail];
      const ccAddresses = input.replyAll ? safeParseJson(original.cc) as string[] : [];
      const replySubject = `Re: ${original.subject}`;

      await sendMailFromAccount(ctx.db, input.accountId, {
        to: toAddresses,
        cc: ccAddresses,
        subject: replySubject,
        bodyHtml: input.body,
        inReplyTo: original.externalId,
      });

      // Fix #8: store reply in sent folder
      await storeSentEmail(ctx.db, {
        accountId: input.accountId,
        fromName: config.fromName || config.from,
        fromEmail: config.from,
        to: toAddresses,
        cc: ccAddresses,
        subject: replySubject,
        bodyHtml: input.body,
      });

      broadcast({ type: "email_sent" });
      return { success: true };
    }),

  // ---------------------------------------------------------------------------
  // List / Read (all scoped to user's accounts)
  // ---------------------------------------------------------------------------

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
      const accountIds = await getUserAccountIds(ctx.db, ctx.session.user.id);
      if (accountIds.length === 0) return [];

      const conditions = [];

      // Fix #1: validate supplied accountId belongs to user
      if (input.accountId) {
        if (!accountIds.includes(input.accountId)) return [];
        conditions.push(eq(emails.accountId, input.accountId));
      } else {
        conditions.push(inArray(emails.accountId, accountIds));
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
        accountId: row.accountId,
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

  // Fix #3: all per-email actions verify ownership
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const accountIds = await getUserAccountIds(ctx.db, ctx.session.user.id);
      const email = await verifyEmailAccess(ctx.db, input.id, accountIds);
      if (!email) return null;

      const attachments = await ctx.db
        .select()
        .from(emailAttachments)
        .where(eq(emailAttachments.emailId, input.id));

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
      const accountIds = await getUserAccountIds(ctx.db, ctx.session.user.id);
      if (accountIds.length === 0) return [];

      const rows = await ctx.db
        .select()
        .from(emails)
        .where(
          and(
            eq(emails.threadId, input.threadId),
            inArray(emails.accountId, accountIds),
          ),
        )
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

  // ---------------------------------------------------------------------------
  // Actions (all verify ownership)
  // ---------------------------------------------------------------------------

  star: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const accountIds = await getUserAccountIds(ctx.db, ctx.session.user.id);
      const email = await verifyEmailAccess(ctx.db, input.id, accountIds);
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
      const accountIds = await getUserAccountIds(ctx.db, ctx.session.user.id);
      if (accountIds.length === 0) return { success: true };
      for (const id of input.ids) {
        await ctx.db.update(emails).set({ read: 1 }).where(
          and(eq(emails.id, id), inArray(emails.accountId, accountIds)),
        );
      }
      return { success: true };
    }),

  markUnread: protectedProcedure
    .input(z.object({ ids: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      const accountIds = await getUserAccountIds(ctx.db, ctx.session.user.id);
      if (accountIds.length === 0) return { success: true };
      for (const id of input.ids) {
        await ctx.db.update(emails).set({ read: 0 }).where(
          and(eq(emails.id, id), inArray(emails.accountId, accountIds)),
        );
      }
      return { success: true };
    }),

  archive: protectedProcedure
    .input(z.object({ ids: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      const accountIds = await getUserAccountIds(ctx.db, ctx.session.user.id);
      if (accountIds.length === 0) return { success: true };
      for (const id of input.ids) {
        await ctx.db.delete(emails).where(
          and(eq(emails.id, id), inArray(emails.accountId, accountIds)),
        );
      }
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ ids: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      const accountIds = await getUserAccountIds(ctx.db, ctx.session.user.id);
      if (accountIds.length === 0) return { success: true };
      for (const id of input.ids) {
        await ctx.db.update(emails).set({ folder: "trash" }).where(
          and(eq(emails.id, id), inArray(emails.accountId, accountIds)),
        );
      }
      return { success: true };
    }),

  snooze: protectedProcedure
    .input(z.object({ id: z.string(), until: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const accountIds = await getUserAccountIds(ctx.db, ctx.session.user.id);
      const email = await verifyEmailAccess(ctx.db, input.id, accountIds);
      if (!email) return { error: "Email not found" };

      const now = new Date();
      let snoozedUntil: Date;
      switch (input.until) {
        case '1h': snoozedUntil = new Date(now.getTime() + 60 * 60 * 1000); break;
        case '3h': snoozedUntil = new Date(now.getTime() + 3 * 60 * 60 * 1000); break;
        case 'tomorrow': {
          snoozedUntil = new Date(now);
          snoozedUntil.setDate(snoozedUntil.getDate() + 1);
          snoozedUntil.setHours(8, 0, 0, 0);
          break;
        }
        case 'nextWeek': {
          snoozedUntil = new Date(now);
          snoozedUntil.setDate(snoozedUntil.getDate() + ((8 - snoozedUntil.getDay()) % 7 || 7));
          snoozedUntil.setHours(8, 0, 0, 0);
          break;
        }
        default: return { error: "Invalid snooze option" };
      }

      // Mark as read and hide from inbox by setting folder to a virtual "snoozed" state
      // We store the snooze info in the labels JSON for simplicity
      const currentLabels = safeParseJson(email.labels) as { name: string; color: string }[];
      const filtered = currentLabels.filter((l) => !l.name.startsWith('__snoozed:'));
      filtered.push({ name: `__snoozed:${snoozedUntil.toISOString()}`, color: '#6b7280' });
      await ctx.db.update(emails).set({
        read: 1,
        labels: JSON.stringify(filtered),
      }).where(eq(emails.id, input.id));

      return { snoozedUntil: snoozedUntil.toISOString() };
    }),

  labelToggle: protectedProcedure
    .input(z.object({ id: z.string(), labelName: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const accountIds = await getUserAccountIds(ctx.db, ctx.session.user.id);
      const email = await verifyEmailAccess(ctx.db, input.id, accountIds);
      if (!email) return { error: "Email not found" };

      // Get the label definition for its color
      const [labelDef] = await ctx.db
        .select()
        .from(emailLabels)
        .where(and(
          eq(emailLabels.name, input.labelName),
          inArray(emailLabels.accountId, accountIds),
        ))
        .limit(1);

      const color = labelDef?.color ?? '#6b7280';
      const currentLabels = safeParseJson(email.labels) as { name: string; color: string }[];
      const existingIdx = currentLabels.findIndex((l) => l.name === input.labelName);

      let newLabels: { name: string; color: string }[];
      if (existingIdx >= 0) {
        newLabels = currentLabels.filter((_, i) => i !== existingIdx);
      } else {
        newLabels = [...currentLabels, { name: input.labelName, color }];
      }

      await ctx.db.update(emails).set({
        labels: JSON.stringify(newLabels),
      }).where(eq(emails.id, input.id));

      return { labels: newLabels };
    }),

  moveToSpam: protectedProcedure
    .input(z.object({ ids: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      const accountIds = await getUserAccountIds(ctx.db, ctx.session.user.id);
      if (accountIds.length === 0) return { success: true };
      for (const id of input.ids) {
        await ctx.db.update(emails).set({ folder: "spam" }).where(
          and(eq(emails.id, id), inArray(emails.accountId, accountIds)),
        );
      }
      return { success: true };
    }),

  // Fix #2: validate accountId in folderCounts
  folderCounts: protectedProcedure
    .input(z.object({ accountId: z.string().optional() }).optional().default({}))
    .query(async ({ ctx, input }) => {
      const accountIds = await getUserAccountIds(ctx.db, ctx.session.user.id);
      if (accountIds.length === 0) return { inbox: 0, sent: 0, drafts: 0, spam: 0, trash: 0, starred: 0 };

      // Validate supplied accountId
      if (input.accountId && !accountIds.includes(input.accountId)) {
        return { inbox: 0, sent: 0, drafts: 0, spam: 0, trash: 0, starred: 0 };
      }

      const ids = input.accountId ? [input.accountId] : accountIds;
      const accountFilter = sql`account_id IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`;

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

  // ---------------------------------------------------------------------------
  // Labels (Fix #4: verify account access)
  // ---------------------------------------------------------------------------

  labels: router({
    list: protectedProcedure
      .input(z.object({ accountId: z.string() }))
      .query(async ({ ctx, input }) => {
        const accountIds = await getUserAccountIds(ctx.db, ctx.session.user.id);
        if (!accountIds.includes(input.accountId)) return [];
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
        const accountIds = await getUserAccountIds(ctx.db, ctx.session.user.id);
        if (!accountIds.includes(input.accountId)) return { error: "Account not found" };

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
        // Verify the label's account belongs to the user
        const [label] = await ctx.db
          .select({ accountId: emailLabels.accountId })
          .from(emailLabels)
          .where(eq(emailLabels.id, input.id))
          .limit(1);
        if (!label) return { error: "Label not found" };

        const accountIds = await getUserAccountIds(ctx.db, ctx.session.user.id);
        if (!accountIds.includes(label.accountId)) return { error: "Not authorized" };

        await ctx.db.delete(emailLabels).where(eq(emailLabels.id, input.id));
        return { success: true };
      }),
  }),

  // ---------------------------------------------------------------------------
  // AI features (verify ownership)
  // ---------------------------------------------------------------------------

  aiSummary: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const accountIds = await getUserAccountIds(ctx.db, ctx.session.user.id);
      const email = await verifyEmailAccess(ctx.db, input.id, accountIds);
      if (!email) return { error: "Email not found" };

      const bodyText = email.bodyText || email.bodyHtml?.replace(/<[^>]+>/g, "") || "";

      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error("ANTHROPIC_API_KEY is not configured.");
      }

      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const aiResponse = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 256,
        system: "Summarize this email in 1-2 concise sentences. Return only the summary.",
        messages: [{ role: "user", content: bodyText }],
      });
      const firstBlock = aiResponse.content[0];
      const result = { text: firstBlock.type === "text" ? firstBlock.text : "" };

      await ctx.db
        .update(emails)
        .set({ aiSummary: result.text })
        .where(eq(emails.id, input.id));

      return { summary: result.text };
    }),

  aiDraft: protectedProcedure
    .input(z.object({ id: z.string(), prompt: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const accountIds = await getUserAccountIds(ctx.db, ctx.session.user.id);
      const email = await verifyEmailAccess(ctx.db, input.id, accountIds);
      if (!email) return { error: "Email not found" };

      const bodyText = email.bodyText || email.bodyHtml?.replace(/<[^>]+>/g, "") || "";

      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error("ANTHROPIC_API_KEY is not configured.");
      }

      const userPrompt = [
        `Subject: ${email.subject || "(no subject)"}`,
        `From: ${email.from || "unknown"}`,
        "",
        bodyText,
        ...(input.prompt ? ["", `Additional instruction: ${input.prompt}`] : []),
      ].join("\n");

      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const aiResponse = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: "Draft a professional reply to this email. Be concise and helpful. Return only the reply text, no subject line or greeting format.",
        messages: [{ role: "user", content: userPrompt }],
      });
      const firstBlock = aiResponse.content[0];
      const result = { text: firstBlock.type === "text" ? firstBlock.text : "" };

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
