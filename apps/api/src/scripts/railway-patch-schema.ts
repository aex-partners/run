/**
 * Non-interactive patches for Railway/staging when drizzle-kit push cannot run in CI
 * (e.g. ambiguous rename prompts). Safe to run multiple times.
 */
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL required");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

async function patch() {
  await sql.unsafe(`ALTER TABLE conversations ADD COLUMN IF NOT EXISTS session_id text`);
  console.log("Patched conversations.session_id if missing.");
  await sql.end();
}

patch().catch((e) => {
  console.error(e);
  process.exit(1);
});
