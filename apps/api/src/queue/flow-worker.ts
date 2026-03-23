import { Worker } from "bullmq";
import { eq } from "drizzle-orm";
import { redisConnection } from "./connection.js";
import { flowRuns, flowVersions } from "../db/schema/index.js";
import { executeFlow } from "../flow-engine/index.js";
import type { FlowTrigger, EngineConstants } from "../flow-engine/types.js";
import { broadcast } from "../ws/index.js";
import { db } from "../db/index.js";

export function startFlowWorker() {
  const worker = new Worker(
    "flow-runs",
    async (job) => {
      const { runId } = job.data as { runId: string };

      // Load run
      const [run] = await db
        .select()
        .from(flowRuns)
        .where(eq(flowRuns.id, runId))
        .limit(1);

      if (!run) {
        console.error(`Flow run ${runId} not found`);
        return;
      }

      if (run.status !== "running" && run.status !== "pending") {
        console.log(`Flow run ${runId} is ${run.status}, skipping`);
        return;
      }

      // Mark as running if pending (retry case)
      if (run.status === "pending") {
        await db.update(flowRuns).set({ status: "running" }).where(eq(flowRuns.id, runId));
      }

      // Load flow version
      if (!run.flowVersionId) {
        console.error(`Flow run ${runId} has no version`);
        return;
      }

      const [version] = await db
        .select()
        .from(flowVersions)
        .where(eq(flowVersions.id, run.flowVersionId))
        .limit(1);

      if (!version) {
        console.error(`Flow version ${run.flowVersionId} not found`);
        return;
      }

      const trigger = JSON.parse(version.trigger) as FlowTrigger;
      const serverUrl = process.env.API_URL || "http://localhost:3001";

      const constants: EngineConstants = {
        flowId: run.flowId,
        flowVersionId: version.id,
        flowRunId: runId,
        projectId: "default",
        serverUrl,
      };

      broadcast({
        type: "flow_run_started",
        runId,
        flowId: run.flowId,
      });

      const startedAt = new Date();

      try {
        const result = await executeFlow(trigger, constants, db, (stepName, output) => {
          // Broadcast step progress
          broadcast({
            type: "flow_run_step",
            runId,
            flowId: run.flowId,
            stepName,
            status: output.status,
          });
        });

        const completedAt = new Date();

        await db
          .update(flowRuns)
          .set({
            status: result.verdict === "SUCCEEDED" ? "succeeded" : "failed",
            steps: JSON.stringify(result.steps),
            duration: result.duration,
            error: result.error ?? null,
            startedAt,
            completedAt,
          })
          .where(eq(flowRuns.id, runId));

        broadcast({
          type: "flow_run_completed",
          runId,
          flowId: run.flowId,
          status: result.verdict === "SUCCEEDED" ? "succeeded" : "failed",
          duration: result.duration,
        });
      } catch (err) {
        const completedAt = new Date();
        const errorMessage = err instanceof Error ? err.message : "Flow execution failed";

        await db
          .update(flowRuns)
          .set({
            status: "failed",
            error: errorMessage,
            startedAt,
            completedAt,
          })
          .where(eq(flowRuns.id, runId));

        broadcast({
          type: "flow_run_failed",
          runId,
          flowId: run.flowId,
          error: errorMessage,
        });
      }
    },
    {
      connection: redisConnection,
      concurrency: 2,
    },
  );

  worker.on("failed", (job, err) => {
    console.error(`Flow job ${job?.id} failed:`, err.message);
  });

  console.log("Flow worker started");
  return worker;
}
