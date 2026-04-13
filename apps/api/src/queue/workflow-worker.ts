import { Worker } from "bullmq";
import { eq } from "drizzle-orm";
import { redisConnection } from "./connection.js";
import { executeWorkflow } from "../workflows/executor.js";
import { workflowExecutions, workflows } from "../db/schema/index.js";
import { broadcast } from "../ws/index.js";
import { db } from "../db/index.js";

export function startWorkflowWorker() {
  const worker = new Worker(
    "workflow-executions",
    async (job) => {
      const { executionId, workflowId: directWorkflowId } = job.data as {
        executionId?: string;
        workflowId?: string;
      };

      // Handle cron-trigger jobs (they have workflowId, not executionId)
      if (!executionId && directWorkflowId) {
        const execId = crypto.randomUUID();
        await db.insert(workflowExecutions).values({
          id: execId,
          workflowId: directWorkflowId,
          triggeredBy: null,
        });

        broadcast({
          type: "workflow_execution_started",
          executionId: execId,
          workflowId: directWorkflowId,
          status: "pending",
        });

        await executeWorkflow(directWorkflowId, null, execId, db);
        return;
      }

      if (!executionId) {
        console.error("Workflow job missing executionId");
        return;
      }

      // Load execution to get workflowId and triggeredBy
      const [execution] = await db
        .select()
        .from(workflowExecutions)
        .where(eq(workflowExecutions.id, executionId))
        .limit(1);

      if (!execution) {
        console.error(`Workflow execution ${executionId} not found`);
        return;
      }

      if (execution.status !== "pending") {
        console.log(`Workflow execution ${executionId} is ${execution.status}, skipping`);
        return;
      }

      await executeWorkflow(
        execution.workflowId,
        execution.triggeredBy,
        executionId,
        db,
      );
    },
    {
      connection: redisConnection,
      concurrency: 2,
    },
  );

  worker.on("failed", async (job, err) => {
    const { captureError } = await import("../observability.js");
    captureError(err, { kind: "workflow-worker-failed", jobId: job?.id });
  });

  console.log("Workflow worker started");
  return worker;
}
