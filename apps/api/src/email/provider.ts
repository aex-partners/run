import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { eq, or, sql } from "drizzle-orm";
import type { Database } from "../db/index.js";
import { settings, emailAccounts, mailAccountMembers } from "../db/schema/index.js";

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  fromName?: string;
  secure: boolean;
}

/** Server-level SMTP defaults (host, port, secure only). Used to pre-fill account forms. */
export interface SmtpDefaults {
  host: string;
  port: number;
  secure: boolean;
}

export interface SendMailOptions {
  to: string[];
  cc?: string[];
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  fromName?: string;
  replyTo?: string;
  inReplyTo?: string;
  attachments?: { filename: string; path: string; contentType?: string }[];
}

export interface SendMailResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
}

// ---------------------------------------------------------------------------
// Read settings
// ---------------------------------------------------------------------------

/** Read server-level SMTP defaults from settings table (host, port, secure only). */
export async function getSmtpDefaults(db: Database): Promise<SmtpDefaults | null> {
  const rows = await db
    .select({ key: settings.key, value: settings.value })
    .from(settings)
    .where(
      or(
        eq(settings.key, "mail.smtp.host"),
        eq(settings.key, "mail.smtp.port"),
        eq(settings.key, "mail.smtp.secure"),
      ),
    );

  const get = (key: string): string => {
    const row = rows.find((r) => r.key === key);
    if (!row) return "";
    try { return String(JSON.parse(row.value)); } catch { return row.value; }
  };

  const host = get("mail.smtp.host");
  if (!host) return null;

  return {
    host,
    port: parseInt(get("mail.smtp.port") || "587", 10),
    secure: get("mail.smtp.secure") === "true",
  };
}

// ---------------------------------------------------------------------------
// Account-level config
// ---------------------------------------------------------------------------

/** Build SmtpConfig from an emailAccounts row. */
function accountToSmtpConfig(account: typeof emailAccounts.$inferSelect): SmtpConfig {
  return {
    host: account.smtpHost,
    port: account.smtpPort,
    user: account.smtpUser,
    pass: account.smtpPass,
    from: account.emailAddress,
    fromName: account.fromName ?? undefined,
    secure: account.smtpSecure === 1,
  };
}

/** Load SMTP config for a specific mail account by ID. */
export async function getAccountSmtpConfig(db: Database, accountId: string): Promise<SmtpConfig | null> {
  const [account] = await db
    .select()
    .from(emailAccounts)
    .where(eq(emailAccounts.id, accountId))
    .limit(1);

  if (!account) return null;
  return accountToSmtpConfig(account);
}

/** Get all mail accounts a user has access to (owned + shared memberships). */
export async function getAccessibleAccountsForUser(
  db: Database,
  userId: string,
): Promise<(typeof emailAccounts.$inferSelect)[]> {
  // Accounts owned by the user
  const owned = await db
    .select()
    .from(emailAccounts)
    .where(eq(emailAccounts.ownerId, userId));

  // Shared accounts the user is a member of (but not owner, to avoid duplicates)
  const memberRows = await db
    .select({ accountId: mailAccountMembers.accountId })
    .from(mailAccountMembers)
    .where(eq(mailAccountMembers.userId, userId));

  const memberAccountIds = memberRows
    .map((r) => r.accountId)
    .filter((id) => !owned.some((a) => a.id === id));

  let shared: (typeof emailAccounts.$inferSelect)[] = [];
  if (memberAccountIds.length > 0) {
    shared = await db
      .select()
      .from(emailAccounts)
      .where(sql`${emailAccounts.id} IN (${sql.join(memberAccountIds.map((id) => sql`${id}`), sql`, `)})`);
  }

  return [...owned, ...shared];
}

/** Get the default mail account for a user (first personal account). */
export async function getDefaultAccountForUser(db: Database, userId: string): Promise<SmtpConfig | null> {
  const accounts = await getAccessibleAccountsForUser(db, userId);
  if (accounts.length === 0) return null;

  // Prefer owned account first
  const personal = accounts.find((a) => a.ownerId === userId) ?? accounts[0];
  return accountToSmtpConfig(personal);
}

/** Check if a user has send access to a specific account. */
export async function userCanSendFrom(db: Database, userId: string, accountId: string): Promise<boolean> {
  // Owner always can
  const [account] = await db
    .select({ ownerId: emailAccounts.ownerId })
    .from(emailAccounts)
    .where(eq(emailAccounts.id, accountId))
    .limit(1);

  if (!account) return false;
  if (account.ownerId === userId) return true;

  // Check membership
  const [member] = await db
    .select({ canSend: mailAccountMembers.canSend })
    .from(mailAccountMembers)
    .where(
      sql`${mailAccountMembers.accountId} = ${accountId} AND ${mailAccountMembers.userId} = ${userId}`,
    )
    .limit(1);

  return member?.canSend === 1;
}

// ---------------------------------------------------------------------------
// Transport & sending
// ---------------------------------------------------------------------------

/** Create a nodemailer transporter from SMTP config. */
export function createTransport(config: SmtpConfig): Transporter {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
  });
}

/** Send an email using a specific SmtpConfig. */
export async function sendMailWithConfig(config: SmtpConfig, options: SendMailOptions): Promise<SendMailResult> {
  const transporter = createTransport(config);

  const from = options.fromName
    ? `${options.fromName} <${config.from}>`
    : config.fromName
      ? `${config.fromName} <${config.from}>`
      : config.from;

  const info = await transporter.sendMail({
    from,
    to: options.to.join(", "),
    cc: options.cc?.join(", "),
    subject: options.subject,
    html: options.bodyHtml,
    text: options.bodyText,
    replyTo: options.replyTo,
    inReplyTo: options.inReplyTo,
    attachments: options.attachments,
  });

  return {
    messageId: info.messageId,
    accepted: (info.accepted || []) as string[],
    rejected: (info.rejected || []) as string[],
  };
}

/** Send an email from a specific mail account (by ID). */
export async function sendMailFromAccount(
  db: Database,
  accountId: string,
  options: SendMailOptions,
): Promise<SendMailResult> {
  const config = await getAccountSmtpConfig(db, accountId);
  if (!config) {
    throw new Error(`Mail account ${accountId} not found.`);
  }
  return sendMailWithConfig(config, options);
}

/** Verify SMTP connection with given config. */
export async function verifySmtpConfig(config: SmtpConfig): Promise<{ ok: boolean; error?: string }> {
  try {
    const transporter = createTransport(config);
    await transporter.verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Connection failed" };
  }
}
