import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
import { eq } from "drizzle-orm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "../../../../.env") });

const { db } = await import("../db/index.js");
const { auth } = await import("../auth/index.js");
const { users } = await import("../db/schema/index.js");
const { addUserToEricConversation, ensureDefaultEricWorkspace } = await import("../services/eric-conversation.js");

/** Default Buenaça team (Gmail plus-addressing → same inbox as buenacagaucha@gmail.com). */
const DEFAULT_TEAM: { email: string; name: string; role: "owner" | "admin" | "user" }[] = [
  { email: "buenacagaucha+sandro@gmail.com", name: "Sandro", role: "admin" },
  { email: "buenacagaucha+sendi@gmail.com", name: "Sendi", role: "user" },
];

function parseTeamFromEnv(): typeof DEFAULT_TEAM {
  const raw = process.env.BUENACA_TEAM_JSON?.trim();
  if (!raw) return DEFAULT_TEAM;
  try {
    const parsed = JSON.parse(raw) as { email: string; name: string; role?: string }[];
    return parsed.map((r) => ({
      email: r.email,
      name: r.name,
      role: (r.role === "owner" || r.role === "admin" ? r.role : "user") as "owner" | "admin" | "user",
    }));
  } catch {
    console.error("Invalid BUENACA_TEAM_JSON, using defaults.");
    return DEFAULT_TEAM;
  }
}

async function provisionStagingUsers() {
  const team = parseTeamFromEnv();
  const password =
    process.env.BUENACA_STAGING_PASSWORD?.trim() || crypto.randomUUID().replace(/-/g, "").slice(0, 16);

  await ensureDefaultEricWorkspace(db);
  console.log("Provisioning staging users (Eric membership + roles)...");
  if (!process.env.BUENACA_STAGING_PASSWORD) {
    console.log("Generated one-time password for new accounts:", password);
  }

  for (const u of team) {
    const [existing] = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.email, u.email)).limit(1);

    if (existing) {
      if (existing.role !== u.role) {
        await db.update(users).set({ role: u.role }).where(eq(users.id, existing.id));
        console.log(`Updated role for ${u.email} -> ${u.role}`);
      }
      await addUserToEricConversation(db, existing.id);
      console.log(`Eric membership ensured for existing ${u.email}`);
      continue;
    }

    const res = await auth.api.signUpEmail({
      body: { name: u.name, email: u.email, password },
    });

    if (!res.user) {
      console.error(`Failed to create ${u.email}`);
      continue;
    }

    await db.update(users).set({ role: u.role }).where(eq(users.id, res.user.id));
    await addUserToEricConversation(db, res.user.id);
    console.log(`Created ${u.email} (${u.name}) role=${u.role}`);
  }

  const everyone = await db.select({ id: users.id }).from(users);
  for (const row of everyone) {
    await addUserToEricConversation(db, row.id);
  }
  console.log(`Eric conversation membership backfilled for ${everyone.length} user(s).`);
  console.log("Done.");
  process.exit(0);
}

provisionStagingUsers().catch((err) => {
  console.error(err);
  process.exit(1);
});
