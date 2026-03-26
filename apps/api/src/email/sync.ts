/**
 * Email sync module.
 *
 * With SMTP-only (no IMAP), there is no inbox sync.
 * This module stores sent emails in the DB so they appear in the Mail UI.
 *
 * IMAP-based inbox sync can be added here in the future.
 */

import type { Database } from "../db/index.js";
import { emails } from "../db/schema/index.js";

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
