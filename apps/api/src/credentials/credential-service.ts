/**
 * Credential management service.
 * Handles CRUD operations for piece credentials (OAuth2, secret text, basic auth, custom auth).
 */

import { eq, and } from "drizzle-orm";
import { credentials } from "../db/schema/index.js";
import type { Database } from "../db/index.js";

export interface CreateCredentialInput {
  name: string;
  pluginName: string;
  type: "oauth2" | "secret_text" | "basic_auth" | "custom_auth";
  value: Record<string, unknown>;
  userId: string;
}

export interface UpdateCredentialInput {
  id: string;
  name?: string;
  value?: Record<string, unknown>;
  status?: "active" | "error" | "missing";
}

/**
 * Create a new credential.
 */
export async function createCredential(
  db: Database,
  input: CreateCredentialInput,
): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date();

  await db.insert(credentials).values({
    id,
    name: input.name,
    pluginName: input.pluginName,
    type: input.type,
    status: "active",
    value: JSON.stringify(input.value),
    createdBy: input.userId,
    createdAt: now,
    updatedAt: now,
  });

  return id;
}

/**
 * Update an existing credential.
 */
export async function updateCredential(
  db: Database,
  input: UpdateCredentialInput,
): Promise<void> {
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (input.name !== undefined) updates.name = input.name;
  if (input.value !== undefined) updates.value = JSON.stringify(input.value);
  if (input.status !== undefined) updates.status = input.status;

  await db.update(credentials).set(updates).where(eq(credentials.id, input.id));
}

/**
 * Delete a credential by ID.
 */
export async function deleteCredential(
  db: Database,
  id: string,
): Promise<void> {
  await db.delete(credentials).where(eq(credentials.id, id));
}

/**
 * Get a credential by ID.
 */
export async function getCredentialById(
  db: Database,
  id: string,
): Promise<typeof credentials.$inferSelect | null> {
  const [row] = await db
    .select()
    .from(credentials)
    .where(eq(credentials.id, id))
    .limit(1);
  return row ?? null;
}

/**
 * Get all credentials for a specific plugin.
 */
export async function getCredentialsByPlugin(
  db: Database,
  pluginName: string,
): Promise<Array<typeof credentials.$inferSelect>> {
  return db
    .select()
    .from(credentials)
    .where(eq(credentials.pluginName, pluginName));
}

/**
 * Get all credentials.
 */
export async function listCredentials(
  db: Database,
): Promise<Array<typeof credentials.$inferSelect>> {
  return db.select().from(credentials);
}

/**
 * Get the decrypted credential value for use in piece execution.
 * For now returns the raw JSON. In production, this should decrypt.
 */
export async function getCredentialValue(
  db: Database,
  credentialName: string,
): Promise<Record<string, unknown> | null> {
  const [row] = await db
    .select()
    .from(credentials)
    .where(eq(credentials.name, credentialName))
    .limit(1);

  if (!row) return null;

  try {
    return JSON.parse(row.value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Get the credential value for a plugin by plugin name.
 * Returns the first active credential for the given plugin.
 * Auto-refreshes OAuth2 tokens if expired.
 */
export async function getCredentialForPlugin(
  db: Database,
  pluginName: string,
): Promise<Record<string, unknown> | null> {
  const [row] = await db
    .select()
    .from(credentials)
    .where(
      and(
        eq(credentials.pluginName, pluginName),
        eq(credentials.status, "active"),
      ),
    )
    .limit(1);

  if (!row) return null;

  try {
    // Try decrypting first
    const { decryptCredentials } = await import("../integrations/crypto.js");
    const value = decryptCredentials(row.value);

    // Auto-refresh OAuth2 tokens if expired
    if (row.type === "oauth2" && value.claimed_at && value.expires_in) {
      const expiresAt = (value.claimed_at as number) + (value.expires_in as number);
      const now = Math.floor(Date.now() / 1000);
      if (now >= expiresAt - 60) {
        const { refreshPluginCredential } = await import("./oauth2-handler.js");
        await refreshPluginCredential(db, row.id);
        // Re-read after refresh
        const [refreshed] = await db
          .select()
          .from(credentials)
          .where(eq(credentials.id, row.id))
          .limit(1);
        if (refreshed) {
          return decryptCredentials(refreshed.value);
        }
      }
    }

    return value;
  } catch {
    // Fallback to plain JSON
    try {
      return JSON.parse(row.value) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}
