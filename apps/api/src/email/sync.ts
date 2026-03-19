import { eq } from "drizzle-orm";
import type { Database } from "../db/index.js";
import { emailAccounts, emails, emailAttachments, integrations } from "../db/schema/index.js";
import { decryptCredentials, encryptCredentials } from "../integrations/crypto.js";
import { refreshAccessToken } from "../integrations/oauth.js";
import { getProvider } from "./provider.js";
import { broadcast } from "../ws/index.js";

export async function syncEmailAccount(db: Database, accountId: string) {
  const [account] = await db
    .select()
    .from(emailAccounts)
    .where(eq(emailAccounts.id, accountId))
    .limit(1);

  if (!account) throw new Error(`Email account ${accountId} not found`);

  const [integration] = await db
    .select()
    .from(integrations)
    .where(eq(integrations.id, account.integrationId))
    .limit(1);

  if (!integration) throw new Error(`Integration ${account.integrationId} not found`);

  // Mark as syncing
  await db
    .update(emailAccounts)
    .set({ syncStatus: "syncing", updatedAt: new Date() })
    .where(eq(emailAccounts.id, accountId));

  try {
    let credentials = decryptCredentials(integration.credentials);
    let accessToken = credentials.accessToken as string;

    // Check if token needs refresh
    const expiresAt = credentials.expiresAt as number | undefined;
    if (expiresAt && Date.now() > expiresAt - 60_000) {
      const refreshToken = credentials.refreshToken as string;
      if (!refreshToken) throw new Error("No refresh token available");

      const oauthConfig = getOAuthConfig(account.provider);
      const refreshed = await refreshAccessToken(oauthConfig, refreshToken);

      credentials = {
        ...credentials,
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken || refreshToken,
        expiresAt: refreshed.expiresIn ? Date.now() + refreshed.expiresIn * 1000 : undefined,
      };

      await db
        .update(integrations)
        .set({ credentials: encryptCredentials(credentials), updatedAt: new Date() })
        .where(eq(integrations.id, integration.id));

      accessToken = refreshed.accessToken;
    }

    const provider = getProvider(account.provider);

    // Sync inbox
    const result = await provider.listMessages(accessToken, "inbox", account.syncCursor || undefined);

    let newCount = 0;
    for (const msg of result.messages) {
      // Upsert email
      const existing = await db
        .select({ id: emails.id })
        .from(emails)
        .where(eq(emails.externalId, msg.id))
        .limit(1);

      if (existing.length > 0) {
        // Update read/starred status
        await db
          .update(emails)
          .set({
            read: msg.read ? 1 : 0,
            starred: msg.starred ? 1 : 0,
          })
          .where(eq(emails.id, existing[0].id));
      } else {
        const emailId = crypto.randomUUID();
        await db.insert(emails).values({
          id: emailId,
          accountId: account.id,
          externalId: msg.id,
          threadId: msg.threadId || null,
          fromName: msg.fromName,
          fromEmail: msg.fromEmail,
          to: JSON.stringify(msg.to),
          cc: JSON.stringify(msg.cc),
          subject: msg.subject,
          preview: msg.preview,
          folder: "inbox",
          read: msg.read ? 1 : 0,
          starred: msg.starred ? 1 : 0,
          hasAttachment: msg.hasAttachment ? 1 : 0,
          labels: JSON.stringify(msg.labels),
          date: msg.date,
        });

        // If there are attachments, fetch full message to get attachment metadata
        if (msg.hasAttachment) {
          try {
            const full = await provider.getMessage(accessToken, msg.id);
            for (const att of full.attachments) {
              await db.insert(emailAttachments).values({
                id: crypto.randomUUID(),
                emailId,
                name: att.name,
                mimeType: att.mimeType,
                size: att.size,
                externalId: att.id,
              });
            }
          } catch {
            // Attachment metadata fetch failed, skip
          }
        }

        newCount++;
      }
    }

    // Update sync state
    await db
      .update(emailAccounts)
      .set({
        syncStatus: "idle",
        lastSyncAt: new Date(),
        syncCursor: result.nextCursor || account.syncCursor,
        updatedAt: new Date(),
      })
      .where(eq(emailAccounts.id, accountId));

    broadcast({
      type: "email_sync_complete",
      accountId,
      newCount,
    });

    return { newCount };
  } catch (error) {
    await db
      .update(emailAccounts)
      .set({ syncStatus: "error", updatedAt: new Date() })
      .where(eq(emailAccounts.id, accountId));

    throw error;
  }
}

function getOAuthConfig(provider: "gmail" | "outlook") {
  if (provider === "gmail") {
    return {
      authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      clientId: process.env.GMAIL_CLIENT_ID || "",
      clientSecret: process.env.GMAIL_CLIENT_SECRET || "",
      redirectUri: `${process.env.APP_URL || "http://localhost:3000"}/api/auth/email/callback`,
    };
  }
  return {
    authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    clientId: process.env.OUTLOOK_CLIENT_ID || "",
    clientSecret: process.env.OUTLOOK_CLIENT_SECRET || "",
    redirectUri: `${process.env.APP_URL || "http://localhost:3000"}/api/auth/email/callback`,
  };
}
