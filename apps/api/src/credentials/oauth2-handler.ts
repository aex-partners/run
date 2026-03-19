/**
 * OAuth2 handler for plugin credentials.
 * Generates auth URLs, handles callbacks, stores tokens, and auto-refreshes.
 */

import { eq } from "drizzle-orm";
import { credentials } from "../db/schema/index.js";
import { generateAuthUrl, exchangeCode, refreshAccessToken } from "../integrations/oauth.js";
import { encryptCredentials, decryptCredentials } from "../integrations/crypto.js";
import type { Database } from "../db/index.js";

interface PluginOAuth2Config {
  authUrl: string;
  tokenUrl: string;
  scope?: string[];
  pkce?: boolean;
  extraParams?: Record<string, string>;
}

/**
 * Generate an OAuth2 authorization URL for a plugin credential.
 */
export function generatePluginAuthUrl(opts: {
  pluginName: string;
  oauthConfig: PluginOAuth2Config;
  clientId: string;
  clientSecret: string;
  userId: string;
  baseUrl: string;
}): string {
  const state = Buffer.from(
    JSON.stringify({
      pluginName: opts.pluginName,
      userId: opts.userId,
      clientSecret: opts.clientSecret,
    }),
  ).toString("base64url");

  const redirectUri = `${opts.baseUrl}/api/credentials/oauth2/callback`;

  return generateAuthUrl(
    {
      authUrl: opts.oauthConfig.authUrl,
      tokenUrl: opts.oauthConfig.tokenUrl,
      clientId: opts.clientId,
      clientSecret: opts.clientSecret,
      scopes: opts.oauthConfig.scope,
      redirectUri,
    },
    state,
  );
}

/**
 * Handle the OAuth2 callback: exchange code for tokens, create/update credential.
 */
export async function handlePluginOAuth2Callback(opts: {
  db: Database;
  code: string;
  state: string;
  baseUrl: string;
}): Promise<{ credentialId: string; pluginName: string }> {
  const { db, code, state, baseUrl } = opts;

  const stateData = JSON.parse(Buffer.from(state, "base64url").toString()) as {
    pluginName: string;
    userId: string;
    clientSecret: string;
  };

  // We need the plugin's OAuth config to get tokenUrl
  // For now we store it in the catalog, but the actual piece has it.
  // The state carries what we need for the token exchange.
  // We need to look up the plugin to get tokenUrl from the catalog.
  const catalogEntry = await getPluginOAuthConfig(stateData.pluginName);
  if (!catalogEntry) {
    throw new Error(`Plugin "${stateData.pluginName}" not found or has no OAuth2 config`);
  }

  const redirectUri = `${baseUrl}/api/credentials/oauth2/callback`;

  // We need clientId. It's stored in plugin config when user sets it up.
  const { plugins } = await import("../db/schema/index.js");
  const [plugin] = await db
    .select()
    .from(plugins)
    .where(eq(plugins.pieceName, stateData.pluginName))
    .limit(1);

  const pluginConfig = plugin ? JSON.parse(plugin.config || "{}") : {};
  const clientId = pluginConfig.clientId || "";

  const tokens = await exchangeCode(
    {
      authUrl: catalogEntry.authUrl,
      tokenUrl: catalogEntry.tokenUrl,
      clientId,
      clientSecret: stateData.clientSecret,
      redirectUri,
    },
    code,
  );

  // Build the credential value in AP format (AppConnectionValue for OAuth2)
  const credValue = {
    type: "OAUTH2",
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken || "",
    expires_in: tokens.expiresIn,
    claimed_at: Math.floor(Date.now() / 1000),
    token_type: tokens.tokenType || "Bearer",
    client_id: clientId,
    client_secret: stateData.clientSecret,
    token_url: catalogEntry.tokenUrl,
    scope: catalogEntry.scope?.join(" ") || "",
    redirect_url: redirectUri,
    data: {},
  };

  // Create or update the credential
  const credId = crypto.randomUUID();
  await db.insert(credentials).values({
    id: credId,
    name: `${plugin?.name || stateData.pluginName} (OAuth2)`,
    pluginName: stateData.pluginName,
    type: "oauth2",
    status: "active",
    value: encryptCredentials(credValue),
    createdBy: stateData.userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return { credentialId: credId, pluginName: stateData.pluginName };
}

/**
 * Refresh an expired OAuth2 credential.
 */
export async function refreshPluginCredential(
  db: Database,
  credentialId: string,
): Promise<boolean> {
  const [cred] = await db
    .select()
    .from(credentials)
    .where(eq(credentials.id, credentialId))
    .limit(1);

  if (!cred || cred.type !== "oauth2") return false;

  const value = decryptCredentials(cred.value) as {
    access_token: string;
    refresh_token: string;
    token_url: string;
    client_id: string;
    client_secret: string;
    expires_in?: number;
    claimed_at?: number;
  };

  if (!value.refresh_token || !value.token_url) return false;

  // Check if token is expired
  if (value.claimed_at && value.expires_in) {
    const expiresAt = value.claimed_at + value.expires_in;
    const now = Math.floor(Date.now() / 1000);
    if (now < expiresAt - 60) {
      // Token still valid (with 60s buffer)
      return true;
    }
  }

  try {
    const refreshed = await refreshAccessToken(
      {
        authUrl: "",
        tokenUrl: value.token_url,
        clientId: value.client_id,
        clientSecret: value.client_secret,
        redirectUri: "",
      },
      value.refresh_token,
    );

    const updatedValue = {
      ...value,
      access_token: refreshed.accessToken,
      refresh_token: refreshed.refreshToken || value.refresh_token,
      expires_in: refreshed.expiresIn || value.expires_in,
      claimed_at: Math.floor(Date.now() / 1000),
    };

    await db
      .update(credentials)
      .set({
        value: encryptCredentials(updatedValue),
        status: "active",
        updatedAt: new Date(),
      })
      .where(eq(credentials.id, credentialId));

    return true;
  } catch (err) {
    console.error(`Failed to refresh credential "${credentialId}":`, err);
    await db
      .update(credentials)
      .set({ status: "error", updatedAt: new Date() })
      .where(eq(credentials.id, credentialId));
    return false;
  }
}

/**
 * Get OAuth2 config from the piece catalog for a given plugin name.
 */
async function getPluginOAuthConfig(
  pieceName: string,
): Promise<{ authUrl: string; tokenUrl: string; scope?: string[] } | null> {
  try {
    const { default: catalog } = await import("../../data/piece-catalog.json", {
      with: { type: "json" },
    });
    const entry = (catalog as Array<{ pieceName: string; auth: { type: string; authUrl?: string; tokenUrl?: string; scope?: string[] } }>)
      .find((e) => e.pieceName === pieceName);

    if (!entry?.auth || entry.auth.type !== "oauth2") return null;
    if (!entry.auth.authUrl || !entry.auth.tokenUrl) return null;

    return {
      authUrl: entry.auth.authUrl,
      tokenUrl: entry.auth.tokenUrl,
      scope: entry.auth.scope,
    };
  } catch {
    return null;
  }
}
