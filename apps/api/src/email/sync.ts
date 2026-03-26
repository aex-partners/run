/**
 * Email sync module.
 *
 * - Stores sent emails locally (SMTP)
 * - Fetches inbox/sent via IMAP, keeping copies on server
 */

import { ImapFlow } from "imapflow";
import { eq } from "drizzle-orm";
import type { Database } from "../db/index.js";
import { emails, emailAccounts } from "../db/schema/index.js";
import { broadcast } from "../ws/index.js";

export interface StoreSentEmailOptions {
  accountId: string;
  fromName: string;
  fromEmail: string;
  to: string[];
  cc?: string[];
  subject: string;
  bodyHtml: string;
  messageId?: string;
}

/** Store a sent email in the DB for the Mail UI. */
export async function storeSentEmail(db: Database, options: StoreSentEmailOptions): Promise<string> {
  const emailId = crypto.randomUUID();

  await db.insert(emails).values({
    id: emailId,
    accountId: options.accountId,
    externalId: options.messageId || emailId,
    fromName: options.fromName,
    fromEmail: options.fromEmail,
    to: JSON.stringify(options.to),
    cc: JSON.stringify(options.cc || []),
    subject: options.subject,
    preview: options.bodyHtml.replace(/<[^>]+>/g, "").slice(0, 200),
    bodyHtml: options.bodyHtml,
    folder: "sent",
    read: 1,
    date: new Date(),
  });

  return emailId;
}

// ---------------------------------------------------------------------------
// IMAP sync
// ---------------------------------------------------------------------------

interface ImapConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  secure: boolean;
}

function getImapConfigFromAccount(
  account: typeof emailAccounts.$inferSelect,
): ImapConfig | null {
  if (!account.imapHost || !account.imapUser || !account.imapPass) return null;
  return {
    host: account.imapHost,
    port: account.imapPort ?? 993,
    user: account.imapUser,
    pass: account.imapPass,
    secure: (account.imapSecure ?? 1) === 1,
  };
}

function createImapClient(config: ImapConfig): ImapFlow {
  return new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    logger: false as any,
    emitLogs: false,
  });
}

/** Map IMAP mailbox names to our folder types. */
function mapFolder(path: string, specialUse?: string): string {
  if (specialUse) {
    const map: Record<string, string> = {
      "\\Inbox": "inbox",
      "\\Sent": "sent",
      "\\Drafts": "drafts",
      "\\Junk": "spam",
      "\\Trash": "trash",
    };
    if (map[specialUse]) return map[specialUse];
  }

  const lower = path.toLowerCase();
  if (lower === "inbox") return "inbox";
  if (lower.includes("sent")) return "sent";
  if (lower.includes("draft")) return "drafts";
  if (lower.includes("spam") || lower.includes("junk") || lower.includes("lixo")) return "spam";
  if (lower.includes("trash") || lower.includes("lixeira") || lower.includes("bin")) return "trash";
  return "inbox";
}

/** Extract email address from a parsed address field. */
function extractAddress(addr: any): { name: string; email: string } {
  if (!addr || !addr.length) return { name: "", email: "" };
  const first = Array.isArray(addr) ? addr[0] : addr;
  return {
    name: first.name || first.address || "",
    email: first.address || "",
  };
}

function extractAddressList(addr: any): string[] {
  if (!addr) return [];
  const list = Array.isArray(addr) ? addr : [addr];
  return list.map((a: any) => a.address || "").filter(Boolean);
}

export interface SyncProgress {
  phase: "connecting" | "listing" | "fetching" | "done";
  folder?: string;
  current?: number;
  total?: number;
}

/**
 * Sync all emails from an IMAP account into the local database.
 * Keeps copies on server (read-only fetch, no deletions).
 */
export async function syncImapAccount(
  db: Database,
  accountId: string,
  onProgress?: (progress: SyncProgress) => void,
): Promise<{ fetched: number; errors: number }> {
  const [account] = await db
    .select()
    .from(emailAccounts)
    .where(eq(emailAccounts.id, accountId))
    .limit(1);

  if (!account) throw new Error(`Account ${accountId} not found`);

  const imapConfig = getImapConfigFromAccount(account);
  if (!imapConfig) throw new Error("IMAP not configured for this account");

  const client = createImapClient(imapConfig);
  let fetched = 0;
  let errors = 0;

  try {
    onProgress?.({ phase: "connecting" });
    await client.connect();

    // Get existing externalIds to skip duplicates
    const existingRows = await db
      .select({ externalId: emails.externalId })
      .from(emails)
      .where(eq(emails.accountId, accountId));
    const existingIds = new Set(existingRows.map((r) => r.externalId));

    // List all mailboxes
    onProgress?.({ phase: "listing" });
    const mailboxes = await client.list();

    // Folders we want to sync
    const foldersToSync = mailboxes.filter((mb) => {
      const folder = mapFolder(mb.path, mb.specialUse);
      return ["inbox", "sent", "drafts", "spam", "trash"].includes(folder);
    });

    for (const mailbox of foldersToSync) {
      const folder = mapFolder(mailbox.path, mailbox.specialUse);
      onProgress?.({ phase: "fetching", folder, current: 0, total: 0 });

      try {
        const lock = await client.getMailboxLock(mailbox.path);

        try {
          const status = client.mailbox;
          const totalMessages = status?.exists ?? 0;

          if (totalMessages === 0) {
            lock.release();
            continue;
          }

          onProgress?.({ phase: "fetching", folder, current: 0, total: totalMessages });

          // Fetch all messages (envelope + body)
          let count = 0;
          for await (const msg of client.fetch("1:*", {
            envelope: true,
            source: true,
            bodyStructure: true,
            flags: true,
          })) {
            count++;

            const messageId = msg.envelope?.messageId || `${accountId}-${msg.uid}`;
            if (existingIds.has(messageId)) continue;

            try {
              const from = extractAddress(msg.envelope?.from);
              const to = extractAddressList(msg.envelope?.to);
              const cc = extractAddressList(msg.envelope?.cc);
              const subject = msg.envelope?.subject || "(No subject)";
              const date = msg.envelope?.date || new Date();

              // Parse body from source
              let bodyText = "";
              let bodyHtml = "";
              if (msg.source) {
                const raw = msg.source.toString();
                const { parseBody } = parseRawEmail(raw);
                bodyText = parseBody.text;
                bodyHtml = parseBody.html;
              }

              const preview = (bodyText || bodyHtml.replace(/<[^>]+>/g, "")).slice(0, 200);
              const isRead = msg.flags?.has("\\Seen") ? 1 : 0;
              const isStarred = msg.flags?.has("\\Flagged") ? 1 : 0;
              const hasAttachment = msg.bodyStructure?.childNodes
                ? msg.bodyStructure.childNodes.some(
                    (n: any) => n.disposition === "attachment",
                  )
                  ? 1
                  : 0
                : 0;

              await db.insert(emails).values({
                id: crypto.randomUUID(),
                accountId,
                externalId: messageId,
                threadId: msg.envelope?.inReplyTo || null,
                fromName: from.name,
                fromEmail: from.email,
                to: JSON.stringify(to),
                cc: JSON.stringify(cc),
                subject,
                preview,
                bodyHtml: bodyHtml || null,
                bodyText: bodyText || null,
                folder,
                read: isRead,
                starred: isStarred,
                hasAttachment,
                labels: "[]",
                date: new Date(date),
              });

              existingIds.add(messageId);
              fetched++;
            } catch (err) {
              errors++;
            }

            if (count % 50 === 0) {
              onProgress?.({ phase: "fetching", folder, current: count, total: totalMessages });
            }
          }
        } finally {
          lock.release();
        }
      } catch (err) {
        errors++;
      }
    }

    // Update lastSyncAt
    await db
      .update(emailAccounts)
      .set({ lastSyncAt: new Date(), updatedAt: new Date() })
      .where(eq(emailAccounts.id, accountId));

    onProgress?.({ phase: "done" });
    broadcast({ type: "email_sync_complete" });
  } finally {
    await client.logout().catch(() => {});
  }

  return { fetched, errors };
}

/** Verify IMAP connection with given credentials. */
export async function verifyImapConfig(config: ImapConfig): Promise<{ ok: boolean; error?: string }> {
  const client = createImapClient(config);
  try {
    await client.connect();
    await client.logout();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "IMAP connection failed" };
  }
}

// ---------------------------------------------------------------------------
// Raw email body parser (handles nested multipart)
// ---------------------------------------------------------------------------

interface ParsedBody {
  text: string;
  html: string;
}

function parseRawEmail(raw: string): { parseBody: ParsedBody } {
  const result: ParsedBody = { text: "", html: "" };
  parsePart(raw, result);
  return { parseBody: result };
}

function parsePart(raw: string, result: ParsedBody): void {
  // Split header from body (handle both \r\n\r\n and \n\n)
  let headerEnd = raw.indexOf("\r\n\r\n");
  let separatorLen = 4;
  if (headerEnd === -1) {
    headerEnd = raw.indexOf("\n\n");
    separatorLen = 2;
  }
  if (headerEnd === -1) {
    if (!result.text) result.text = raw;
    return;
  }

  const headers = raw.slice(0, headerEnd);
  const headersLower = headers.toLowerCase();
  const body = raw.slice(headerEnd + separatorLen);

  // Check for multipart boundary
  const boundaryMatch = headersLower.match(/boundary="?([^";\r\n]+)"?/);

  if (boundaryMatch) {
    const boundary = boundaryMatch[1].trim();
    const parts = body.split(`--${boundary}`);

    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed === "--" || trimmed === "") continue;
      // Skip the closing boundary marker
      if (part.startsWith("--")) continue;

      // Remove trailing -- from the last part
      const cleanPart = part.replace(/--\s*$/, "");
      parsePart(cleanPart.replace(/^\r?\n/, ""), result);
    }
  } else {
    // Leaf part: decode content
    let content = body.replace(/--\s*$/, "").trim();

    if (headersLower.includes("quoted-printable")) {
      content = decodeQuotedPrintable(content);
    } else if (headersLower.includes("base64")) {
      try {
        content = Buffer.from(content.replace(/\s/g, ""), "base64").toString("utf-8");
      } catch { /* skip */ }
    }

    if (headersLower.includes("text/html") && !result.html) {
      result.html = content;
    } else if (headersLower.includes("text/plain") && !result.text) {
      result.text = content;
    }
  }
}

function decodeQuotedPrintable(str: string): string {
  return str
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}
