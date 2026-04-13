import { query } from "@anthropic-ai/claude-agent-sdk";
import { randomUUID } from "node:crypto";
import { db as defaultDb } from "../db/index.js";
import { resolveAgentForConversation } from "../ai/agent-resolver.js";
import { buildMcpServer } from "../ai/mcp-server-factory.js";
import { isReadOnlyTool } from "../ai/tool-registry.js";
import { taskLogs } from "../db/schema/index.js";
import type { ToolContext } from "../ai/types.js";
import type { Database } from "../db/index.js";

// Per-execution safety budgets for unattended scheduled tasks. Read-only tools
// are unlimited; mutating tools are counted, with tighter sub-caps on the
// operations that are either irreversible (delete_record) or observable to
// third parties (send_email). If an agent tries to exceed a cap it gets a
// "denied" tool result and can decide how to proceed in the remaining turns.
const DEFAULT_MUTATION_BUDGET = Number(process.env.TASK_MUTATION_BUDGET ?? 5);
const DEFAULT_DELETE_BUDGET = Number(process.env.TASK_DELETE_BUDGET ?? 0);
const DEFAULT_EMAIL_BUDGET = Number(process.env.TASK_EMAIL_BUDGET ?? 1);

class TaskCancelledException extends Error {
  constructor() {
    super("Task was cancelled");
    this.name = "TaskCancelledException";
  }
}

interface TaskInput {
  id: string;
  type: string;
  title: string;
  input: string | null;
  conversationId: string | null;
  createdBy: string;
  agentId: string | null;
  toolName: string | null;
  structuredInput: string | null;
  outputSchema?: string | null;
  createdAt?: Date | null;
}

async function runInferenceTask(task: TaskInput, db: Database): Promise<string> {
  if (!task.input || !task.input.trim()) {
    throw new Error("Inference task requires a non-empty input prompt");
  }
  if (!task.conversationId) {
    throw new Error("Inference task requires a conversation_id so the result has somewhere to land");
  }

  const agentConfig = await resolveAgentForConversation(task.conversationId, task.createdBy);
  const toolContext: ToolContext = { db, userId: task.createdBy, conversationId: task.conversationId };
  const mcpServer = buildMcpServer({ agentConfig, toolContext });

  // Scheduled tasks run without a human-in-the-loop, so we replace the
  // interactive confirmation flow with hard budgets on mutating operations
  // and an append to task_logs for every call. The audit trail lets an admin
  // review exactly what the task did after the fact.
  let mutationsUsed = 0;
  let deletesUsed = 0;
  let emailsUsed = 0;

  async function logStep(
    level: "info" | "warn" | "error" | "step",
    message: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await db.insert(taskLogs).values({
        id: randomUUID(),
        taskId: task.id,
        level,
        message,
        metadata: metadata ? JSON.stringify(metadata) : null,
      });
    } catch (err) {
      // Logging must never break task execution.
      console.error("[task-runner] failed to write task_log:", err instanceof Error ? err.message : err);
    }
  }

  const canUseTool = async (toolName: string, input: unknown) => {
    if (isReadOnlyTool(toolName)) return { behavior: "allow" as const };

    if (toolName === "mcp__aex__delete_record") {
      if (deletesUsed >= DEFAULT_DELETE_BUDGET) {
        await logStep("warn", `denied ${toolName}: delete budget exhausted`, { input });
        return {
          behavior: "deny" as const,
          message: `delete_record is disabled in scheduled tasks (budget=${DEFAULT_DELETE_BUDGET}). Ask the user to run this from chat so they can confirm.`,
        };
      }
      deletesUsed += 1;
    }
    if (toolName === "mcp__aex__send_email") {
      if (emailsUsed >= DEFAULT_EMAIL_BUDGET) {
        await logStep("warn", `denied ${toolName}: email budget exhausted`, { input });
        return {
          behavior: "deny" as const,
          message: `send_email budget exhausted for this task (max ${DEFAULT_EMAIL_BUDGET}).`,
        };
      }
      emailsUsed += 1;
    }
    if (mutationsUsed >= DEFAULT_MUTATION_BUDGET) {
      await logStep("warn", `denied ${toolName}: mutation budget exhausted`, { input });
      return {
        behavior: "deny" as const,
        message: `Mutation budget exhausted for this scheduled task (${DEFAULT_MUTATION_BUDGET}). Summarise what still needs to happen and stop.`,
      };
    }
    mutationsUsed += 1;
    await logStep("step", `allowed ${toolName}`, { input });
    return { behavior: "allow" as const };
  };

  await logStep("info", "scheduled task starting", { conversationId: task.conversationId, prompt: task.input });

  const options: Record<string, unknown> = {
    systemPrompt: agentConfig.systemPrompt,
    mcpServers: { aex: mcpServer },
    allowedTools: [
      "mcp__aex__*",
      "WebSearch", "WebFetch", "ToolSearch",
      "Bash", "Read", "Write", "Edit", "Glob", "Grep",
      "Agent", "AskUserQuestion", "TodoWrite",
    ],
    canUseTool,
    maxTurns: 15,
    includePartialMessages: false,
    cwd: process.cwd(),
    thinking: { type: "adaptive" },
    model: agentConfig.modelId || "claude-sonnet-4-6",
  };

  let finalText = "";
  for await (const message of query({ prompt: task.input, options: options as any })) {
    if (message.type === "assistant") {
      const content = (message as any).message?.content ?? (message as any).content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === "text" && typeof block.text === "string") {
            finalText += block.text;
          }
        }
      }
    }
  }

  await logStep("info", "scheduled task finished", {
    mutationsUsed, deletesUsed, emailsUsed, textLength: finalText.length,
  });

  return finalText.trim() || "(scheduled task finished with no text output)";
}

export async function runTask(task: TaskInput, db: Database = defaultDb): Promise<string> {
  if (task.type === "structured") {
    // Structured mode is declared on the schema (toolName + structuredInput)
    // but deterministic scheduled execution of a single tool has not been
    // implemented here yet. Callers who need a fixed tool invocation today
    // should wrap it in an inference prompt until this is filled in.
    throw new Error("structured task execution is not implemented yet; use type=\"inference\" with a prompt instead");
  }
  return runInferenceTask(task, db);
}

export { TaskCancelledException };
