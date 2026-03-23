/**
 * Piece catalog registry.
 * Syncs the bundled piece-catalog.json into the plugins table.
 * Pieces appear with source "piece" and status "available" until installed.
 */

import { eq } from "drizzle-orm";
import { plugins } from "../db/schema/index.js";
import type { Database } from "../db/index.js";

interface PieceCatalogEntry {
  id: string;
  name: string;
  pieceName: string;
  displayName: string;
  description: string;
  version: string;
  category: string;
  logoUrl: string;
  auth: { type: string };
  source: "piece" | "local";
}

/**
 * Load the bundled piece catalog from disk.
 */
async function loadPieceCatalog(): Promise<PieceCatalogEntry[]> {
  try {
    const { default: catalog } = await import("../../data/piece-catalog.json", {
      with: { type: "json" },
    });
    return catalog as PieceCatalogEntry[];
  } catch {
    return [];
  }
}

/**
 * Sync the piece catalog into the plugins table.
 * Creates new entries for pieces not yet in the DB.
 * Updates metadata for existing entries while preserving install state.
 */
export async function syncPieceCatalog(db: Database): Promise<number> {
  const entries = await loadPieceCatalog();
  let synced = 0;

  for (const entry of entries) {
    const [existing] = await db
      .select()
      .from(plugins)
      .where(eq(plugins.id, entry.id))
      .limit(1);

    if (existing) {
      // Update metadata but preserve status, config, and install info
      await db
        .update(plugins)
        .set({
          name: entry.displayName,
          description: entry.description,
          version: entry.version,
          category: entry.category,
          pieceName: entry.pieceName,
          authType: entry.auth.type,
          icon: entry.logoUrl,
          source: entry.source === "local" ? "local" : "piece",
          updatedAt: new Date(),
        })
        .where(eq(plugins.id, entry.id));
    } else {
      // Local pieces are auto-installed; registry pieces start as "available"
      const isLocal = entry.source === "local";
      await db.insert(plugins).values({
        id: entry.id,
        name: entry.displayName,
        description: entry.description,
        version: entry.version,
        category: entry.category,
        pieceName: entry.pieceName,
        authType: entry.auth.type,
        icon: entry.logoUrl,
        source: isLocal ? "local" : "piece",
        status: isLocal ? "installed" : "available",
        config: "{}",
      });
    }
    synced++;
  }

  return synced;
}
