import { eq } from "drizzle-orm";
import { workflows, workflowExecutions, tasks } from "../db/schema/index.js";
import { broadcast } from "../ws/index.js";
import { runTask } from "../queue/task-runner.js";
import type { Database } from "../db/index.js";

interface GraphNode {
  id: string;
  type: string;
  data: {
    label: string;
    config?: Record<string, unknown>;
    taskType?: string;
    toolName?: string;
    toolInput?: Record<string, unknown>;
    agentId?: string | null;
    skillId?: string | null;
  };
  position: { x: number; y: number };
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
}

interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface ExecutionContext {
  results: Record<string, unknown>;
  lastResult: unknown;
}

/**
 * Topological sort of graph nodes based on edges.
 * Returns nodes in execution order.
 */
function topologicalSort(graph: Graph): GraphNode[] {
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const node of graph.nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  for (const edge of graph.edges) {
    adjacency.get(edge.source)?.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }

  const sorted: GraphNode[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const node = nodeMap.get(id);
    if (node) sorted.push(node);

    for (const neighbor of adjacency.get(id) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) queue.push(neighbor);
    }
  }

  return sorted;
}

/**
 * Execute an action node by creating a task and running it inline.
 */
async function executeActionNode(
  node: GraphNode,
  context: ExecutionContext,
  executionId: string,
  db: Database,
  userId: string,
): Promise<unknown> {
  const instruction = node.data.label || "Execute action";
  const taskType = node.data.taskType || "inference";
  const toolName = node.data.toolName ?? null;
  const toolInput = node.data.toolInput ?? null;
  const agentId = node.data.agentId ?? null;

  // Create a task record for this workflow step
  const taskId = crypto.randomUUID();
  const contextSummary = context.lastResult
    ? `Previous step result: ${JSON.stringify(context.lastResult).slice(0, 500)}`
    : "";

  await db.insert(tasks).values({
    id: taskId,
    title: `[Workflow] ${instruction}`.slice(0, 200),
    description: instruction,
    input: contextSummary ? `${instruction}\n\n${contextSummary}` : instruction,
    createdBy: userId,
    type: taskType as "inference" | "structured",
    agentId,
    toolName,
    structuredInput: toolInput ? JSON.stringify(toolInput) : null,
    workflowExecutionId: executionId,
    status: "running",
    startedAt: new Date(),
  });

  try {
    const result = await runTask(
      {
        id: taskId,
        title: instruction,
        input: contextSummary ? `${instruction}\n\n${contextSummary}` : instruction,
        conversationId: null,
        createdBy: userId,
        type: taskType,
        agentId,
        toolName,
        structuredInput: toolInput ? JSON.stringify(toolInput) : null,
        outputSchema: null,
      },
      db,
    );

    // Mark task completed
    await db
      .update(tasks)
      .set({ status: "completed", result, completedAt: new Date(), progress: 100 })
      .where(eq(tasks.id, taskId));

    // Try to parse JSON result for structured output
    try {
      return JSON.parse(result);
    } catch {
      return result;
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await db
      .update(tasks)
      .set({ status: "failed", error, completedAt: new Date() })
      .where(eq(tasks.id, taskId));
    throw err;
  }
}

/**
 * Evaluate a condition node based on the context.
 */
function evaluateCondition(_node: GraphNode, context: ExecutionContext): boolean {
  const lastResult = context.lastResult;
  if (lastResult === null || lastResult === undefined) return false;

  if (typeof lastResult === "boolean") return lastResult;
  if (typeof lastResult === "string") return lastResult.length > 0;
  if (typeof lastResult === "number") return lastResult > 0;
  if (typeof lastResult === "object") {
    const obj = lastResult as Record<string, unknown>;
    if ("count" in obj) return (obj.count as number) > 0;
    if ("records" in obj && Array.isArray(obj.records)) return obj.records.length > 0;
    if ("error" in obj) return false;
    return true;
  }
  return !!lastResult;
}

/**
 * Get downstream targets for a condition node based on the branch taken.
 */
function getConditionTargets(
  nodeId: string,
  branchTaken: boolean,
  edges: GraphEdge[],
): string[] {
  return edges
    .filter((e) => {
      if (e.source !== nodeId) return false;
      if (branchTaken)
        return e.sourceHandle === "yes" || e.sourceHandle === null || e.sourceHandle === undefined;
      return e.sourceHandle === "no";
    })
    .map((e) => e.target);
}

/**
 * Main workflow execution engine.
 */
export async function executeWorkflow(
  workflowId: string,
  triggeredBy: string | null,
  executionId: string,
  db: Database,
): Promise<void> {
  const [workflow] = await db
    .select()
    .from(workflows)
    .where(eq(workflows.id, workflowId))
    .limit(1);

  if (!workflow) {
    await db
      .update(workflowExecutions)
      .set({ status: "failed", error: "Workflow not found", completedAt: new Date() })
      .where(eq(workflowExecutions.id, executionId));
    return;
  }

  const startedAt = new Date();
  await db
    .update(workflowExecutions)
    .set({ status: "running", startedAt })
    .where(eq(workflowExecutions.id, executionId));

  broadcast({
    type: "workflow_execution_started",
    executionId,
    workflowId,
    status: "running",
  });

  const graph: Graph = JSON.parse(workflow.graph);
  const context: ExecutionContext = { results: {}, lastResult: null };
  const userId = triggeredBy ?? workflow.createdBy;

  try {
    const sortedNodes = topologicalSort(graph);
    const skipNodes = new Set<string>();

    for (const node of sortedNodes) {
      if (skipNodes.has(node.id)) continue;

      broadcast({
        type: "workflow_execution_step",
        executionId,
        nodeId: node.id,
        nodeName: node.data.label,
        status: "running",
      });

      try {
        switch (node.type) {
          case "trigger":
            break;

          case "action": {
            const result = await executeActionNode(node, context, executionId, db, userId);
            context.results[node.id] = result;
            context.lastResult = result;
            break;
          }

          case "condition": {
            const conditionResult = evaluateCondition(node, context);
            context.results[node.id] = conditionResult;

            const yesTargets = getConditionTargets(node.id, true, graph.edges);
            const noTargets = getConditionTargets(node.id, false, graph.edges);

            if (conditionResult) {
              for (const t of noTargets) skipNodes.add(t);
            } else {
              for (const t of yesTargets) skipNodes.add(t);
            }
            break;
          }

          case "notification": {
            const message = node.data.label || "Workflow notification";
            const lastResultStr = context.lastResult
              ? `\n\nContext: ${JSON.stringify(context.lastResult).slice(0, 500)}`
              : "";
            context.results[node.id] = { notified: true, message };

            broadcast({
              type: "workflow_notification",
              workflowId,
              executionId,
              message: message + lastResultStr,
            });
            break;
          }
        }

        broadcast({
          type: "workflow_execution_step",
          executionId,
          nodeId: node.id,
          nodeName: node.data.label,
          status: "completed",
          result: context.results[node.id],
        });
      } catch (stepErr) {
        const error = stepErr instanceof Error ? stepErr.message : String(stepErr);

        broadcast({
          type: "workflow_execution_step",
          executionId,
          nodeId: node.id,
          nodeName: node.data.label,
          status: "failed",
          result: error,
        });

        throw stepErr;
      }
    }

    await db
      .update(workflowExecutions)
      .set({
        status: "completed",
        result: JSON.stringify(context.results),
        completedAt: new Date(),
      })
      .where(eq(workflowExecutions.id, executionId));

    broadcast({
      type: "workflow_execution_completed",
      executionId,
      workflowId,
      result: context.results,
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);

    await db
      .update(workflowExecutions)
      .set({
        status: "failed",
        error,
        completedAt: new Date(),
      })
      .where(eq(workflowExecutions.id, executionId));

    broadcast({
      type: "workflow_execution_failed",
      executionId,
      workflowId,
      error,
    });
  }
}

/**
 * Generate a ReactFlow graph from workflow steps.
 */
export function generateGraphFromSteps(
  steps: Array<{
    type: string;
    label: string;
    config?: Record<string, unknown>;
    taskType?: string;
    toolName?: string;
    toolInput?: Record<string, unknown>;
    agentId?: string | null;
  }>,
): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  const triggerId = "trigger-1";
  nodes.push({
    id: triggerId,
    type: "trigger",
    position: { x: 250, y: 50 },
    data: { label: "Trigger" },
  });

  let prevId = triggerId;
  const Y_SPACING = 120;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const nodeId = `${step.type}-${i + 1}`;

    nodes.push({
      id: nodeId,
      type: step.type,
      position: { x: 250, y: 50 + (i + 1) * Y_SPACING },
      data: {
        label: step.label,
        ...(step.config ? { config: step.config } : {}),
        ...(step.taskType ? { taskType: step.taskType } : {}),
        ...(step.toolName ? { toolName: step.toolName } : {}),
        ...(step.toolInput ? { toolInput: step.toolInput } : {}),
        ...(step.agentId ? { agentId: step.agentId } : {}),
      },
    });

    edges.push({
      id: `e-${prevId}-${nodeId}`,
      source: prevId,
      target: nodeId,
    });

    prevId = nodeId;
  }

  return { nodes, edges };
}
