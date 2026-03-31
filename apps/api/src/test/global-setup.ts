import { config } from "dotenv";
import { resolve } from "path";
import { execSync } from "child_process";

export async function setup() {
  config({ path: resolve(import.meta.dirname, "../../.env.test"), override: true });

  const mainUrl = process.env.DATABASE_URL!;
  // Connect to default 'postgres' DB to create the test DB
  const adminUrl = mainUrl.replace(/\/[^/]+$/, "/postgres");

  const { default: postgres } = await import("postgres");

  const adminSql = postgres(adminUrl, { max: 1 });
  try {
    // Drop and recreate test DB for a clean slate
    await adminSql.unsafe("DROP DATABASE IF EXISTS aex_test");
    await adminSql.unsafe("CREATE DATABASE aex_test");
  } finally {
    await adminSql.end();
  }

  // Ensure pgvector extension exists
  const testSql = postgres(mainUrl, { max: 1 });
  try {
    await testSql.unsafe("CREATE EXTENSION IF NOT EXISTS vector");
  } finally {
    await testSql.end();
  }

  // Push schema using drizzle-kit
  execSync("npx drizzle-kit push --force", {
    cwd: resolve(import.meta.dirname, "../.."),
    env: { ...process.env, DATABASE_URL: mainUrl },
    stdio: "inherit",
  });
}

export async function teardown() {
  // Leave DB around for debugging; next run will drop+recreate
}
