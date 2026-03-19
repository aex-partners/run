import { eq } from "drizzle-orm";
import { plugins, customTools } from "../db/schema/index.js";
import type { Database } from "../db/index.js";
import type { PluginManifest } from "./types.js";

/**
 * Install a plugin: parse manifest, insert tools into customTools, update status.
 */
export async function installPlugin(
  db: Database,
  pluginId: string,
  userId: string,
): Promise<void> {
  const [plugin] = await db
    .select()
    .from(plugins)
    .where(eq(plugins.id, pluginId))
    .limit(1);

  if (!plugin) throw new Error(`Plugin not found: ${pluginId}`);
  if (plugin.status === "installed") return;

  const manifest: PluginManifest = JSON.parse(plugin.manifest);

  // Materialize plugin tools as customTools rows
  if (manifest.tools && manifest.tools.length > 0) {
    const toolRows = manifest.tools.map((t) => ({
      id: crypto.randomUUID(),
      name: `${pluginId}:${t.name}`,
      description: t.description,
      inputSchema: JSON.stringify(t.inputSchema),
      type: t.type as "http" | "code" | "mcp",
      config: JSON.stringify(t.config),
      isReadOnly: true,
      pluginId: pluginId,
      createdBy: userId,
    }));

    await db.insert(customTools).values(toolRows);
  }

  await db
    .update(plugins)
    .set({
      status: "installed",
      installedAt: new Date(),
      installedBy: userId,
      updatedAt: new Date(),
    })
    .where(eq(plugins.id, pluginId));
}

/**
 * Uninstall a plugin: delete tools (cascade from FK), reset status.
 */
export async function uninstallPlugin(
  db: Database,
  pluginId: string,
): Promise<void> {
  // Delete plugin tools explicitly (FK cascade also handles this)
  await db.delete(customTools).where(eq(customTools.pluginId, pluginId));

  await db
    .update(plugins)
    .set({
      status: "available",
      installedAt: null,
      installedBy: null,
      config: "{}",
      updatedAt: new Date(),
    })
    .where(eq(plugins.id, pluginId));
}

/**
 * Update plugin configuration.
 */
export async function configurePlugin(
  db: Database,
  pluginId: string,
  config: Record<string, unknown>,
): Promise<void> {
  await db
    .update(plugins)
    .set({
      config: JSON.stringify(config),
      updatedAt: new Date(),
    })
    .where(eq(plugins.id, pluginId));
}

/**
 * Enable or disable a plugin.
 */
export async function setPluginStatus(
  db: Database,
  pluginId: string,
  enabled: boolean,
): Promise<void> {
  const [plugin] = await db
    .select()
    .from(plugins)
    .where(eq(plugins.id, pluginId))
    .limit(1);

  if (!plugin) throw new Error(`Plugin not found: ${pluginId}`);

  // Only toggle between installed/disabled (not available)
  if (plugin.status === "available") {
    throw new Error("Cannot toggle a plugin that is not installed");
  }

  await db
    .update(plugins)
    .set({
      status: enabled ? "installed" : "disabled",
      updatedAt: new Date(),
    })
    .where(eq(plugins.id, pluginId));
}
