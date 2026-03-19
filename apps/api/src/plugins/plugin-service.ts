import { eq } from "drizzle-orm";
import { plugins, customTools } from "../db/schema/index.js";
import type { Database } from "../db/index.js";
import type { PluginManifest } from "./types.js";
import { installPiece, uninstallPiece } from "./piece-installer.js";
import { clearPieceCache } from "./piece-loader.js";

/**
 * Install a plugin: for piece-based plugins, sets status to "installing" immediately
 * and runs npm install in background. For manifest-based plugins, materializes tools.
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
  if (plugin.status === "installed" || plugin.status === "installing") return;
  // Allow retry from error status
  if (plugin.status === "error" && plugin.pieceName) {
    // Reset and re-attempt
  }

  if (plugin.pieceName) {
    // Set status to "installing" immediately so UI can show progress
    await db
      .update(plugins)
      .set({
        status: "installing",
        installedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(plugins.id, pluginId));

    // Run npm install in background (fire-and-forget)
    installPiece(plugin.pieceName)
      .then(async () => {
        await db
          .update(plugins)
          .set({
            status: "installed",
            installedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(plugins.id, pluginId));
        console.log(`Plugin "${plugin.name}" installed successfully`);
      })
      .catch(async (err) => {
        console.error(`Plugin "${plugin.name}" install failed:`, err);
        await db
          .update(plugins)
          .set({
            status: "error",
            updatedAt: new Date(),
          })
          .where(eq(plugins.id, pluginId));
      });

    return;
  }

  if (!plugin.manifest) {
    throw new Error("Plugin has no manifest and no piece name");
  }

  // Manifest-based plugin: materialize tools (synchronous, fast)
  const manifest: PluginManifest = JSON.parse(plugin.manifest);

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
 * Uninstall a plugin: for piece-based, runs npm uninstall;
 * for manifest-based, deletes tools from customTools.
 */
export async function uninstallPlugin(
  db: Database,
  pluginId: string,
): Promise<void> {
  const [plugin] = await db
    .select()
    .from(plugins)
    .where(eq(plugins.id, pluginId))
    .limit(1);

  if (plugin?.pieceName) {
    try {
      await uninstallPiece(plugin.pieceName);
    } catch (err) {
      console.error(`Failed to uninstall piece package: ${err}`);
    }
    clearPieceCache();
  }

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

  // Only toggle between installed/disabled (not available/installing/error)
  if (plugin.status === "available" || plugin.status === "installing") {
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
