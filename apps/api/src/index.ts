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
const { startEmailSyncWorker } = await import("./queue/email-worker.js");
const { startBlingSyncWorker } = await import("./queue/bling-worker.js");
const { loadActiveTriggers } = await import("./workflows/triggers.js");
const { db } = await import("./db/index.js");

const app = await buildServer();

try {
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  startTaskWorker();
  startWorkflowWorker();
  startFlowWorker();
  startEmailSyncWorker();
  startBlingSyncWorker();
  await loadActiveTriggers(db);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
