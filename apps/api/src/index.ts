import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, "../../../.env") });

const { env } = await import("./env.js");
const { buildServer } = await import("./server.js");
const { startTaskWorker } = await import("./queue/task-worker.js");
const { startWorkflowWorker } = await import("./queue/workflow-worker.js");
const { startFlowWorker } = await import("./queue/flow-worker.js");
const { startEmailWorker } = await import("./queue/email-worker.js");
const { startBlingSyncWorker } = await import("./queue/bling-worker.js");
const { startFileIndexingWorker } = await import("./queue/file-indexing-worker.js");
const { startReminderWorker } = await import("./queue/reminder-worker.js");
const { probeSearxngHealth } = await import("./ai/system-tools/search-tools.js");
const { loadActiveTriggers } = await import("./workflows/triggers.js");
const { db, runMigrations } = await import("./db/index.js");

await runMigrations();

const app = await buildServer();

try {
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  startTaskWorker();
  startWorkflowWorker();
  startFlowWorker();
  startEmailWorker();
  startBlingSyncWorker();
  startFileIndexingWorker();
  startReminderWorker();
  probeSearxngHealth().catch(() => { /* already logs internally */ });
  await loadActiveTriggers(db);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
