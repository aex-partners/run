import { eq } from "drizzle-orm";
import { plugins } from "../db/schema/index.js";
import type { Database } from "../db/index.js";
import type { PluginManifest } from "./types.js";

interface RegistryEntry {
  manifest: PluginManifest;
  source: "registry" | "local" | "git";
  sourceUrl?: string;
}

/**
 * Load the bundled plugin registry from disk.
 */
async function loadBundledRegistry(): Promise<RegistryEntry[]> {
  try {
    const { default: catalog } = await import("../../data/plugin-registry.json", {
      with: { type: "json" },
    });
    return (catalog as unknown as PluginManifest[]).map((manifest) => ({
      manifest,
      source: "registry" as const,
    }));
  } catch {
    return [];
  }
}

/**
 * Sync the plugin registry: upsert catalog entries into the plugins table.
 * Preserves installed/disabled status for existing plugins.
 */
export async function syncRegistry(db: Database): Promise<number> {
  const entries = await loadBundledRegistry();
  let synced = 0;

  for (const entry of entries) {
    const manifest = entry.manifest;
    const [existing] = await db
      .select()
      .from(plugins)
      .where(eq(plugins.id, manifest.id))
      .limit(1);

    if (existing) {
      // Update metadata but preserve status, config, and install info
      await db
        .update(plugins)
        .set({
          name: manifest.name,
          description: manifest.description,
          version: manifest.version,
          author: manifest.author,
          icon: manifest.icon ?? null,
          category: manifest.category,
          manifest: JSON.stringify(manifest),
          source: entry.source,
          sourceUrl: entry.sourceUrl ?? null,
          updatedAt: new Date(),
        })
        .where(eq(plugins.id, manifest.id));
    } else {
      await db.insert(plugins).values({
        id: manifest.id,
        name: manifest.name,
        description: manifest.description,
        version: manifest.version,
        author: manifest.author,
        icon: manifest.icon ?? null,
        category: manifest.category,
        manifest: JSON.stringify(manifest),
        source: entry.source,
        sourceUrl: entry.sourceUrl ?? null,
        status: "available",
        config: "{}",
      });
    }
    synced++;
  }

  return synced;
}
