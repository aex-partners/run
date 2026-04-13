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
const { probeSearxngHealth, setSearxngAvailable } = await import("./ai/system-tools/search-tools.js");
const { reconcileOnBoot } = await import("./queue/reconcile.js");
const { loadActiveTriggers } = await import("./workflows/triggers.js");
const { db, runMigrations } = await import("./db/index.js");

await runMigrations();
await reconcileOnBoot();

const app = await buildServer();

const workers: Array<{ close: () => Promise<void> }> = [];

try {
  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  workers.push(startTaskWorker() as unknown as { close: () => Promise<void> });
  workers.push(startWorkflowWorker() as unknown as { close: () => Promise<void> });
  workers.push(startFlowWorker() as unknown as { close: () => Promise<void> });
  workers.push(startEmailWorker() as unknown as { close: () => Promise<void> });
  workers.push(startBlingSyncWorker() as unknown as { close: () => Promise<void> });
  workers.push(startFileIndexingWorker() as unknown as { close: () => Promise<void> });
  workers.push(startReminderWorker() as unknown as { close: () => Promise<void> });
  probeSearxngHealth().then((ok) => setSearxngAvailable(ok)).catch(() => setSearxngAvailable(false));
  await loadActiveTriggers(db);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

// Graceful shutdown: Railway sends SIGTERM on redeploy. Give in-flight jobs
// a few seconds to finish, then exit. boot-reconcile handles anything that
// still ends up orphaned on the next boot.
let shuttingDown = false;
async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[shutdown] received ${signal}, closing workers and server`);
  const deadline = Date.now() + 20_000;
  try {
    await Promise.race([
      Promise.all(workers.map((w) => w.close())),
      new Promise((resolve) => setTimeout(resolve, Math.max(0, deadline - Date.now()))),
    ]);
  } catch (err) {
    console.error("[shutdown] worker close failed:", err);
  }
  try {
    await app.close();
  } catch (err) {
    console.error("[shutdown] server close failed:", err);
  }
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
