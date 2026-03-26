import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import * as schema from "../db/schema/index.js";
// AI layer removed
type ToolContext = { db: unknown; userId: string; conversationId?: string };

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _client: ReturnType<typeof postgres> | null = null;

export function getTestDb() {
  if (!_db) {
    _client = postgres(process.env.DATABASE_URL!);
    _db = drizzle(_client, { schema });
  }
  return _db;
}

export async function closeTestDb() {
  if (_client) {
    await _client.end();
    _client = null;
    _db = null;
  }
}

// Order respects FK constraints (children before parents)
const TRUNCATE_ORDER = [
  "form_submissions",
  "forms",
  "email_attachments",
  "emails",
  "email_labels",
  "email_accounts",
  "file_shares",
  "files",
  "task_logs",
  "tasks",
  "workflow_executions",
  "workflows",
  "entity_records",
  "entities",
  "custom_tools",
  "skills",
  "messages",
  "conversation_members",
  "conversations",
  "agents",
  "plugins",
  "integrations",
  "settings",
  "sessions",
  "accounts",
  "users",
];

export async function cleanDb() {
  const db = getTestDb();
  for (const table of TRUNCATE_ORDER) {
    await db.execute(sql.raw(`DELETE FROM "${table}"`));
  }
}

export const TEST_USER_ID = "test-user-001";

export async function seedTestUser(db: ReturnType<typeof drizzle<typeof schema>>) {
  await db.insert(schema.users).values({
    id: TEST_USER_ID,
    name: "Test User",
    email: "test@aex.local",
    emailVerified: true,
    role: "admin",
  }).onConflictDoNothing();
}

export function createToolContext(
  db: ReturnType<typeof drizzle<typeof schema>>,
  overrides?: Partial<ToolContext>,
): ToolContext {
  return {
    db: db as unknown as ToolContext["db"],
    userId: TEST_USER_ID,
    conversationId: "test-conv-001",
    ...overrides,
  };
}
