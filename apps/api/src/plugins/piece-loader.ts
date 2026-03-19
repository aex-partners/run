/**
 * Dynamic loader for ActivePieces piece packages.
 * Imports @activepieces/piece-* packages and returns Piece instances.
 * Resolves packages from the dedicated .pieces/ directory where they are installed at runtime.
 */

import { createRequire } from "node:module";
import { join } from "node:path";
import type { Piece } from "@activepieces/pieces-framework";
import { getPiecesNodeModulesDir } from "./piece-installer.js";

const pieceCache = new Map<string, Piece>();

/**
 * Dynamically import a piece package by npm name.
 * Resolves from the .pieces/node_modules/ directory where pieces are installed at runtime.
 */
export async function loadPiece(pieceName: string): Promise<Piece | null> {
  if (pieceCache.has(pieceName)) {
    return pieceCache.get(pieceName)!;
  }

  const packageName = pieceName.startsWith("@activepieces/")
    ? pieceName
    : `@activepieces/piece-${pieceName}`;

  try {
    // Try loading from the dedicated pieces directory first
    const piecesDir = getPiecesNodeModulesDir();
    const require = createRequire(join(piecesDir, "_virtual.js"));
    const resolved = require.resolve(packageName);
    const mod = await import(resolved);

    const piece = findPieceExport(mod);
    if (!piece) {
      console.warn(`No Piece export found in package "${packageName}"`);
      return null;
    }

    pieceCache.set(pieceName, piece);
    return piece;
  } catch {
    // Fallback: try importing from the main project's node_modules
    try {
      const mod = await import(packageName);
      const piece = findPieceExport(mod);
      if (piece) {
        pieceCache.set(pieceName, piece);
        return piece;
      }
    } catch {
      // Neither location has the package
    }

    console.error(`Failed to load piece "${packageName}": package not found`);
    return null;
  }
}

/**
 * Find the Piece instance from a module's exports.
 * Community pieces may export it as default, or as a named export.
 */
function findPieceExport(mod: Record<string, unknown>): Piece | null {
  // Check default export first
  if (mod.default && isPiece(mod.default)) {
    return mod.default as Piece;
  }

  // Check named exports
  for (const key of Object.keys(mod)) {
    if (isPiece(mod[key])) {
      return mod[key] as Piece;
    }
  }

  return null;
}

/**
 * Duck-type check for a Piece instance.
 */
function isPiece(obj: unknown): boolean {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.displayName === "string" &&
    typeof o.actions === "function" &&
    typeof o.triggers === "function"
  );
}

/**
 * Clear the piece cache (useful for hot-reload during development).
 */
export function clearPieceCache(): void {
  pieceCache.clear();
}
