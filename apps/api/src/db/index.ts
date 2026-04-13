import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import postgres from "postgres";
import { env } from "../env.js";
import * as schema from "./schema/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const client = postgres(env.DATABASE_URL, {
  max: Number(process.env.PG_POOL_MAX ?? 30),
  idle_timeout: 30,
  connect_timeout: 10,
});
export const db = drizzle(client, { schema });
export type Database = typeof db;

export async function runMigrations() {
  const migrationsFolder = resolve(__dirname, "../../drizzle");
  console.log("Running database migrations...");
  await migrate(db, { migrationsFolder });
  console.log("Migrations complete.");
}
