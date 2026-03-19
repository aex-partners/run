/**
 * Runtime piece package installer.
 * Installs @activepieces/piece-* npm packages on demand when users install plugins.
 * Uses a dedicated directory for piece packages to avoid polluting the main project.
 */

import { execFile } from "node:child_process";
import { mkdir, writeFile, access, readFile } from "node:fs/promises";
import { join } from "node:path";

const PIECES_DIR =
  process.env.PIECES_DIR || join(process.cwd(), ".pieces");

// In-flight install locks to prevent concurrent installs of the same package
const installLocks = new Map<string, Promise<void>>();

/**
 * Ensure the pieces directory exists with a valid package.json.
 */
async function ensurePiecesDir(): Promise<void> {
  await mkdir(PIECES_DIR, { recursive: true });

  const pkgPath = join(PIECES_DIR, "package.json");
  try {
    await access(pkgPath);
  } catch {
    await writeFile(
      pkgPath,
      JSON.stringify(
        {
          name: "aex-pieces",
          version: "1.0.0",
          private: true,
          dependencies: {},
        },
        null,
        2,
      ),
    );
  }
}

/**
 * Check if a piece package is already installed.
 */
export async function isPieceInstalled(packageName: string): Promise<boolean> {
  try {
    const pkgDir = join(PIECES_DIR, "node_modules", ...packageName.split("/"));
    await access(pkgDir);
    return true;
  } catch {
    return false;
  }
}

/**
 * Install a piece package via npm.
 * Uses mutual exclusion to prevent concurrent installs of the same package.
 */
export async function installPiece(packageName: string): Promise<void> {
  // Normalize package name
  const fullName = packageName.startsWith("@activepieces/")
    ? packageName
    : `@activepieces/piece-${packageName}`;

  // Check if already installed
  if (await isPieceInstalled(fullName)) {
    return;
  }

  // Check for in-flight install
  const existing = installLocks.get(fullName);
  if (existing) {
    return existing;
  }

  const promise = doInstall(fullName);
  installLocks.set(fullName, promise);

  try {
    await promise;
  } finally {
    installLocks.delete(fullName);
  }
}

/**
 * Uninstall a piece package.
 */
export async function uninstallPiece(packageName: string): Promise<void> {
  const fullName = packageName.startsWith("@activepieces/")
    ? packageName
    : `@activepieces/piece-${packageName}`;

  await ensurePiecesDir();

  await new Promise<void>((resolve, reject) => {
    execFile(
      "npm",
      ["uninstall", fullName],
      { cwd: PIECES_DIR, timeout: 120_000 },
      (error) => {
        if (error) {
          console.error(`Failed to uninstall piece "${fullName}":`, error);
          reject(new Error(`Failed to uninstall piece: ${error.message}`));
        } else {
          resolve();
        }
      },
    );
  });
}

/**
 * Internal: perform the actual npm install.
 */
async function doInstall(fullName: string): Promise<void> {
  await ensurePiecesDir();

  console.log(`Installing piece: ${fullName}...`);

  await new Promise<void>((resolve, reject) => {
    execFile(
      "npm",
      ["install", fullName, "--save", "--legacy-peer-deps"],
      {
        cwd: PIECES_DIR,
        timeout: 180_000,
        env: {
          ...process.env,
          // Avoid interactive prompts
          npm_config_yes: "true",
        },
      },
      (error, stdout, stderr) => {
        if (error) {
          console.error(`Failed to install piece "${fullName}":`, error);
          console.error("stderr:", stderr);
          reject(new Error(`Failed to install piece "${fullName}": ${error.message}`));
        } else {
          console.log(`Piece "${fullName}" installed successfully`);
          resolve();
        }
      },
    );
  });
}

/**
 * Get the pieces directory path (for piece-loader resolution).
 */
export function getPiecesDir(): string {
  return PIECES_DIR;
}

/**
 * Get the node_modules path where pieces are installed.
 */
export function getPiecesNodeModulesDir(): string {
  return join(PIECES_DIR, "node_modules");
}

/**
 * List all installed piece packages by reading the pieces package.json.
 */
export async function listInstalledPieces(): Promise<string[]> {
  try {
    const pkgPath = join(PIECES_DIR, "package.json");
    const content = await readFile(pkgPath, "utf-8");
    const pkg = JSON.parse(content);
    return Object.keys(pkg.dependencies || {}).filter((name) =>
      name.startsWith("@activepieces/piece-"),
    );
  } catch {
    return [];
  }
}
