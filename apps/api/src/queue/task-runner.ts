import { query } from "@anthropic-ai/claude-agent-sdk";
import { db as defaultDb } from "../db/index.js";
import { resolveAgentForConversation } from "../ai/agent-resolver.js";
import { buildMcpServer } from "../ai/mcp-server-factory.js";
import type { ToolContext } from "../ai/types.js";
import type { Database } from "../db/index.js";

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

  const options: Record<string, unknown> = {
    systemPrompt: agentConfig.systemPrompt,
    mcpServers: { aex: mcpServer },
    allowedTools: [
      "mcp__aex__*",
      "WebSearch", "WebFetch", "ToolSearch",
      "Bash", "Read", "Write", "Edit", "Glob", "Grep",
      "Agent", "AskUserQuestion", "TodoWrite",
    ],
    // Scheduled tasks run without an interactive user to confirm mutations.
    // The user already authorised the work when they scheduled it.
    canUseTool: async () => ({ behavior: "allow" as const }),
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
