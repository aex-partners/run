import { generateText, stepCountIs } from "ai";
import { eq, desc, and, lte } from "drizzle-orm";
import { getModel } from "../ai/client.js";
import { createWorkerTools } from "../ai/tools.js";
import { getToolsForAgent, buildCustomTool } from "../ai/tool-registry.js";
import { messages, tasks, taskLogs, customTools } from "../db/schema/index.js";
import { broadcast } from "../ws/index.js";
import type { Database } from "../db/index.js";

class TaskCancelledException extends Error {
  constructor() {
    super("Task was cancelled");
    this.name = "TaskCancelledException";
  }
}

async function addLog(
  db: Database,
  taskId: string,
  level: "info" | "warn" | "error" | "step",
  message: string,
  metadata?: unknown,
) {
  const id = crypto.randomUUID();
  const log = {
    id,
    taskId,
    level,
    message,
    metadata: metadata ? JSON.stringify(metadata) : null,
  };
  await db.insert(taskLogs).values(log);

  broadcast({
    type: "task_log",
    taskId,
    log: { id, level, message, createdAt: new Date().toISOString() },
  });

  return id;
}

interface TaskInput {
  id: string;
  title: string;
  input: string;
  conversationId: string | null;
  createdBy: string;
  type: string;
  agentId: string | null;
  toolName: string | null;
  structuredInput: string | null;
  outputSchema: string | null;
  createdAt: Date | null;
}

/**
 * Run a structured task: call a specific tool directly without LLM.
 */
async function runStructuredTask(task: TaskInput, db: Database): Promise<string> {
  if (!task.toolName) {
    throw new Error("Structured task missing toolName");
  }

  await addLog(db, task.id, "info", `Starting structured task: ${task.title}`);
  await addLog(db, task.id, "step", `Calling tool: ${task.toolName}`);

  const input = task.structuredInput ? JSON.parse(task.structuredInput) : {};
  const ctx = { db, userId: task.createdBy, conversationId: task.conversationId ?? undefined };

  // Try system tools first
  const systemTools = createWorkerTools(ctx) as Record<string, any>;
  let toolFn = systemTools[task.toolName];

  // If not a system tool, try custom tools
  if (!toolFn) {
    const [toolRow] = await db
      .select()
      .from(customTools)
      .where(eq(customTools.name, task.toolName))
      .limit(1);

    if (toolRow) {
      toolFn = buildCustomTool(toolRow, ctx);
    }
  }

  if (!toolFn) {
    throw new Error(`Tool "${task.toolName}" not found`);
  }

  const result = await toolFn.execute(input, { toolCallId: crypto.randomUUID() });

  // Validate output against outputSchema if defined
  if (task.outputSchema) {
    try {
      const { jsonSchemaToZod } = await import("../ai/json-schema-to-zod.js");
      const schema = jsonSchemaToZod(JSON.parse(task.outputSchema));
      const validation = schema.safeParse(result);
      if (!validation.success) {
        await addLog(db, task.id, "warn", `Output validation failed: ${validation.error.message}`);
      }
    } catch (err) {
      await addLog(db, task.id, "warn", `Output schema validation error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Update progress
  await db.update(tasks).set({ progress: 100 }).where(eq(tasks.id, task.id));
  broadcast({
    type: "task_updated",
    task: { id: task.id, status: "running", progress: 100, title: task.title },
  });

  await addLog(db, task.id, "info", "Structured task completed");

  return typeof result === "string" ? result : JSON.stringify(result);
}

/**
 * Run an inference task: use LLM with tools (original behavior), agent-aware.
 */
async function runInferenceTask(task: TaskInput, db: Database): Promise<string> {
  const contextMessages: Array<{ role: "user" | "assistant"; content: string }> = [];

  // Load conversation context from when the task was created (not current state).
  // This preserves the original topic even if the user changed subjects after scheduling.
  if (task.conversationId) {
    const filter = task.createdAt
      ? and(
          eq(messages.conversationId, task.conversationId),
          lte(messages.createdAt, task.createdAt),
        )
      : eq(messages.conversationId, task.conversationId);

    const rows = await db
      .select({ content: messages.content, role: messages.role })
      .from(messages)
      .where(filter)
      .orderBy(desc(messages.createdAt))
      .limit(10);

    rows.reverse();
    for (const row of rows) {
      if (row.role === "user") {
        contextMessages.push({ role: "user", content: row.content });
      } else if (row.role === "ai") {
        contextMessages.push({ role: "assistant", content: row.content });
      }
    }
  }

  // Resolve agent configuration
  let resolvedModel = await getModel();
  let resolvedTools: Record<string, unknown>;
  let agentPromptAddendum = "";

  const ctx = {
    db,
    userId: task.createdBy,
    conversationId: task.conversationId ?? undefined,
  };

  if (task.agentId) {
    try {
      const agentConfig = await getToolsForAgent(task.agentId, ctx, db);
      resolvedModel = await getModel(agentConfig.modelId);
      resolvedTools = agentConfig.tools as Record<string, unknown>;
      agentPromptAddendum = agentConfig.systemPromptFragments.join("\n\n");
    } catch {
      resolvedTools = createWorkerTools(ctx) as Record<string, unknown>;
    }
  } else {
    resolvedTools = createWorkerTools(ctx) as Record<string, unknown>;
  }

  const systemPrompt = `You are Eric, executing a background task for the user inside an ERP system. You have NO ability to schedule, delay, or create other tasks.

Task: ${task.title}
Instructions: ${task.input}
${agentPromptAddendum ? `\n## Agent Instructions\n${agentPromptAddendum}` : ""}

After executing with the available tools, write a natural, conversational message to the user as if you were reporting back in a chat. Examples of good responses:
- "Você me pediu para listar os usuários. Encontrei 3: Alice, Bob e Carol. Se quiser detalhes de algum, é só falar."
- "Pronto! O relatório ficou assim: 15 pedidos no mês, total de R$12.500. Quer que eu detalhe por cliente?"

Rules:
- Use the same language the user used in the conversation.
- Be brief and natural. No robotic templates.
- Present the data clearly.
- You may offer to discuss the results further, but keep it to one short sentence.
- Do NOT discuss your capabilities or limitations.`;

  await addLog(db, task.id, "info", `Starting task: ${task.title}`);

  // Check for cancellation before starting
  const [current] = await db
    .select({ status: tasks.status })
    .from(tasks)
    .where(eq(tasks.id, task.id))
    .limit(1);
  if (current?.status === "cancelled") {
    throw new TaskCancelledException();
  }

  let stepCount = 0;

  const result = await generateText({
    model: resolvedModel,
    maxTokens: 2048,
    system: systemPrompt,
    messages: contextMessages,
    tools: resolvedTools,
    stopWhen: stepCountIs(10),
    async onStepFinish({ toolCalls }) {
      stepCount++;

      // Log tool calls
      if (toolCalls) {
        for (const tc of toolCalls) {
          await addLog(db, task.id, "step", `Calling ${tc.toolName}`, tc.args);
        }
      }

      // Update progress
      const progress = Math.min(Math.round((stepCount / 10) * 100), 95);
      await db.update(tasks).set({ progress }).where(eq(tasks.id, task.id));
      broadcast({
        type: "task_updated",
        task: { id: task.id, status: "running", progress, title: task.title },
      });

      // Check for cancellation between steps
      const [check] = await db
        .select({ status: tasks.status })
        .from(tasks)
        .where(eq(tasks.id, task.id))
        .limit(1);
      if (check?.status === "cancelled") {
        throw new TaskCancelledException();
      }
    },
  });

  await addLog(db, task.id, "info", "Task completed");

  return result.text || "Task completed";
}

export async function runTask(
  task: TaskInput,
  db: Database,
): Promise<string> {
  if (task.type === "structured") {
    return runStructuredTask(task, db);
  }
  return runInferenceTask(task, db);
}

export { TaskCancelledException };
