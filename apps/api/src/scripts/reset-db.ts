import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { execSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, "../../../..");
const apiDir = resolve(__dirname, "../..");

config({ path: resolve(root, ".env") });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL not set in .env");
  process.exit(1);
}

console.log("Dropping all tables...");

const postgres = (await import("postgres")).default;
const sql = postgres(dbUrl);

await sql.unsafe(`
  DO $$ DECLARE
    r RECORD;
  BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
      EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;
  END $$
`);

await sql.unsafe(`
  DO $$ DECLARE
    r RECORD;
  BEGIN
    FOR r IN (SELECT typname FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'public' AND t.typtype = 'e') LOOP
      EXECUTE 'DROP TYPE IF EXISTS public.' || quote_ident(r.typname) || ' CASCADE';
    END LOOP;
  END $$
`);

await sql.end();

console.log("All tables and types dropped.");

console.log("Pushing schema...");
execSync("npx drizzle-kit push --force", { cwd: apiDir, stdio: "inherit" });

console.log("Database reset complete. Ready for onboarding at /setup.");
process.exit(0);
