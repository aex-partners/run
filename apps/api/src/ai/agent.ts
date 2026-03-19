import { streamText, generateText, stepCountIs, type CoreMessage } from "ai";
import { eq, desc, asc } from "drizzle-orm";
import { model } from "./client.js";
import { getModel } from "./client.js";
import { buildSystemPrompt } from "./prompts.js";
import {
  createTools,
  shouldAutoExecute,
  type ToolContext,
} from "./tools.js";
import { getToolsForAgent } from "./tool-registry.js";
import { storePendingAction } from "./pending-actions.js";
import { messages, conversationMembers, conversations, customTools as customToolsTable } from "../db/schema/index.js";
import { sendToConversation } from "../ws/index.js";
import { DEFAULT_AGENT_ID, DEFAULT_AGENT_NAME } from "@aex/shared";
import type { Database } from "../db/index.js";

// Abort controllers for in-flight AI calls per conversation
const activeControllers = new Map<string, AbortController>();

async function getMemberIds(conversationId: string, db: Database): Promise<string[]> {
  const members = await db
    .select({ userId: conversationMembers.userId })
    .from(conversationMembers)
    .where(eq(conversationMembers.conversationId, conversationId));
  return members.map((m) => m.userId);
}

async function loadContext(conversationId: string, db: Database): Promise<CoreMessage[]> {
  const rows = await db
    .select({
      content: messages.content,
      role: messages.role,
    })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(30);

  // Reverse to ASC order
  rows.reverse();

  // Simple token estimation and trimming
  let estimatedTokens = 0;
  const contextMessages: CoreMessage[] = [];
  for (const row of rows) {
    estimatedTokens += Math.ceil(row.content.length / 4);
    if (estimatedTokens > 100_000) break;
    if (row.role === "user") {
      contextMessages.push({ role: "user", content: row.content });
    } else if (row.role === "ai") {
      contextMessages.push({ role: "assistant", content: row.content });
    } else {
      contextMessages.push({ role: "user", content: `[System] ${row.content}` });
    }
  }
  return contextMessages;
}

function describeAction(toolName: string, args: Record<string, unknown>) {
  switch (toolName) {
    case "create_conversation":
      return {
        preface: `I'll create a conversation called "${args.name}".`,
        question: `Create conversation "${args.name}"?`,
        detail: "This will create a new AI conversation.",
      };
    case "rename_conversation":
      return {
        preface: `I'll rename the conversation to "${args.name}".`,
        question: `Rename conversation to "${args.name}"?`,
        detail: "This will update the conversation name.",
      };
    case "delete_conversation":
      return {
        preface: "I'll delete this conversation.",
        question: "Delete this conversation?",
        detail: "This action cannot be undone.",
      };
    case "send_message":
      return {
        preface: "I'll send a message to the conversation.",
        question: "Send this message?",
        detail: `Content: "${(args.content as string)?.slice(0, 100)}"`,
      };
    case "create_task": {
      const delay = args.schedule_in_minutes as number | undefined;
      const when = delay && delay > 0 ? ` (scheduled in ${delay} min)` : "";
      return {
        preface: `I'll create a background task: "${args.title}"${when}.`,
        question: `Create task "${args.title}"${when}?`,
        detail: (args.description as string) || "",
      };
    }
    case "cancel_task":
      return {
        preface: "I'll cancel this task.",
        question: "Cancel this task?",
        detail: "The task will be stopped.",
      };
    case "create_entity": {
      const fieldNames =
        (args.fields as Array<{ name: string }>)?.map((f) => f.name).join(", ") || "";
      return {
        preface: `I'll create the entity "${args.name}" with fields: ${fieldNames}.`,
        question: `Create entity "${args.name}"?`,
        detail: `Fields: ${fieldNames}`,
      };
    }
    case "save_company_profile": {
      const profileType = args.type as string;
      const profileName = args.name as string | undefined;
      return {
        preface: `I'll save your company profile${profileName ? ` for "${profileName}"` : ""} (${profileType}).`,
        question: "Save company profile?",
        detail: `Type: ${profileType}. Processes: ${(args.processes as string[])?.join(", ") || "none"}`,
      };
    }
    case "add_field":
      return {
        preface: `I'll add the field "${args.name}" (${args.type}) to the entity.`,
        question: `Add field "${args.name}"?`,
        detail: `Type: ${args.type}`,
      };
    case "insert_record":
      return {
        preface: `I'll insert a new record into "${args.entity_id_or_name}".`,
        question: `Insert record into "${args.entity_id_or_name}"?`,
        detail: JSON.stringify(args.data, null, 2).slice(0, 200),
      };
    case "update_record":
      return {
        preface: "I'll update this record.",
        question: "Update this record?",
        detail: JSON.stringify(args.data, null, 2).slice(0, 200),
      };
    case "delete_record":
      return {
        preface: "I'll delete this record.",
        question: "Delete this record?",
        detail: "This action cannot be undone.",
      };
    case "create_workflow": {
      const steps = (args.steps as Array<{ type: string; label: string }>) || [];
      const stepList = steps.map((s) => `${s.type}: ${s.label}`).join(", ");
      return {
        preface: `I'll create the workflow "${args.name}" with ${steps.length} steps.`,
        question: `Create workflow "${args.name}"?`,
        detail: `Trigger: ${args.trigger_type}. Steps: ${stepList}`,
      };
    }
    case "execute_workflow":
      return {
        preface: "I'll execute this workflow now.",
        question: "Execute this workflow?",
        detail: "The workflow will run in the background.",
      };
    case "update_workflow":
      return {
        preface: "I'll update the workflow.",
        question: "Update this workflow?",
        detail: args.steps
          ? `New steps: ${(args.steps as Array<{ label: string }>).map((s) => s.label).join(", ")}`
          : "Updating workflow settings.",
      };
    case "assign_agent":
      return {
        preface: `I'll assign agent "${args.agent_id}" to this conversation.`,
        question: "Assign this agent?",
        detail: "The conversation will use a different AI agent.",
      };
    default:
      return {
        preface: `I'll execute ${toolName}.`,
        question: `Execute ${toolName}?`,
        detail: "",
      };
  }
}

/**
 * Marker prefix returned by intercepted mutating tools.
 * When the AI SDK calls execute on a mutating tool, the intercepted execute
 * returns this string so we can detect it in onStepFinish and stop the loop.
 */
const PENDING_MARKER = "__PENDING_CONFIRMATION__";

async function streamAIResponse(
  chatMessages: CoreMessage[],
  conversationId: string,
  userId: string,
  db: Database,
  signal: AbortSignal,
  systemPrompt: string,
  isOnboarding = false,
  resolvedModel = model,
  resolvedTools?: Record<string, unknown>,
  customReadOnlyTools?: Set<string>,
  agentId = DEFAULT_AGENT_ID,
  agentName = DEFAULT_AGENT_NAME,
): Promise<void> {
  const memberIds = await getMemberIds(conversationId, db);
  const messageId = crypto.randomUUID();
  let fullText = "";
  let started = false;

  const ctx: ToolContext = { db, userId, conversationId };
  const fallbackTools = resolvedTools ?? (() => {
    const tools = createTools(ctx) as Record<string, unknown>;
    // Default (no agent): strip web tools for safety
    delete tools.web_search;
    delete tools.fetch_url;
    return tools;
  })();
  const allTools = fallbackTools;

  // Collect pending actions created by intercepted mutating tools
  const pendingActions: Array<{
    actionId: string;
    toolName: string;
    args: Record<string, unknown>;
    toolCallId: string;
  }> = [];

  // Build chat tools: all tools have execute (valid schemas), but mutating tools
  // are intercepted to create pending actions instead of executing.
  // We clone the tool object and replace execute to preserve the original Zod schema.
  const chatTools: Record<string, unknown> = {};

  for (const [name, t] of Object.entries(allTools)) {
    if (shouldAutoExecute(name, isOnboarding, customReadOnlyTools)) {
      // Read-only tools (and onboarding auto-tools) keep their real execute
      chatTools[name] = t;
    } else {
      // Mutating tools: clone and replace execute to intercept
      chatTools[name] = {
        ...(t as object),
        execute: async (args: Record<string, unknown>, options: { toolCallId: string }) => {
          const actionId = crypto.randomUUID();
          pendingActions.push({
            actionId,
            toolName: name,
            args,
            toolCallId: options.toolCallId,
          });
          return `${PENDING_MARKER}${actionId}`;
        },
      };
    }
  }

  const result = streamText({
    model: resolvedModel,
    maxTokens: 4096,
    system: systemPrompt,
    messages: chatMessages,
    tools: chatTools,
    toolChoice: "auto",
    stopWhen: stepCountIs(20),
    abortSignal: signal,
    onChunk({ chunk }) {
      if (chunk.type === "text-delta") {
        if (!started) {
          started = true;
          sendToConversation(memberIds, {
            type: "ai_stream_start",
            conversationId,
            messageId,
          });
        }
        fullText += (chunk as any).text;
        sendToConversation(memberIds, {
          type: "ai_stream_chunk",
          conversationId,
          messageId,
          content: (chunk as any).text,
        });
      }
    },
    onStepFinish({ toolCalls }) {
      // For auto-executed mutating tools (onboarding), emit collapsible detail messages
      if (!toolCalls) return;

      for (const tc of toolCalls) {
        // Skip read-only tools and intercepted mutating tools
        if (!shouldAutoExecute(tc.toolName, isOnboarding, customReadOnlyTools)) continue;
        if (tc.toolName === "list_users" || tc.toolName === "list_tasks" ||
            tc.toolName === "query_records" || tc.toolName === "list_entities" ||
            tc.toolName === "list_workflows" || tc.toolName === "list_agents") continue;
        // Skip custom read-only tools from detail messages
        if (customReadOnlyTools?.has(tc.toolName)) continue;

        // This was a real auto-executed mutating tool (onboarding), show detail
        const description = describeAction(tc.toolName, tc.args as Record<string, unknown>);
        const detailMsgId = crypto.randomUUID();
        const detailMetadata = JSON.stringify({
          toolExecution: {
            toolName: tc.toolName,
            summary: description.question,
            detail: description.detail,
          },
        });

        db.insert(messages)
          .values({
            id: detailMsgId,
            conversationId,
            authorId: null,
            agentId,
            content: description.preface,
            role: "ai",
            metadata: detailMetadata,
          })
          .then(() => {
            sendToConversation(memberIds, {
              type: "new_message",
              message: {
                id: detailMsgId,
                conversationId,
                authorId: null,
                authorName: agentName,
                content: description.preface,
                role: "ai",
                createdAt: new Date().toISOString(),
                metadata: {
                  toolExecution: {
                    toolName: tc.toolName,
                    summary: description.question,
                    detail: description.detail,
                  },
                },
              },
            });
          })
          .catch((err: unknown) => console.error("Error saving tool detail:", err));
      }
    },
  });

  // Consume the full stream
  const finalText = await result.text;
  const response = await result.response;

  // End stream
  if (started) {
    sendToConversation(memberIds, {
      type: "ai_stream_end",
      conversationId,
      messageId,
    });
  }

  // Check if any mutating tools were intercepted
  if (pendingActions.length > 0) {
    // Save any text the AI streamed before the tool call
    const textToSave = fullText.replace(new RegExp(`${PENDING_MARKER}[a-f0-9-]+`, "g"), "").trim();
    if (textToSave) {
      await db.insert(messages).values({
        id: messageId,
        conversationId,
        authorId: null,
        agentId,
        content: textToSave,
        role: "ai",
      });
      sendToConversation(memberIds, {
        type: "new_message",
        message: {
          id: messageId,
          conversationId,
          authorId: null,
          agentId,
          authorName: agentName,
          content: textToSave,
          role: "ai",
          createdAt: new Date().toISOString(),
        },
      });
    }

    // Create pending action for each intercepted mutating tool call
    const responseMessages = response.messages;
    for (const pa of pendingActions) {
      const actionMsgId = crypto.randomUUID();
      const description = describeAction(pa.toolName, pa.args);

      await storePendingAction({
        actionId: pa.actionId,
        conversationId,
        userId,
        toolName: pa.toolName,
        toolInput: pa.args,
        assistantMessages: responseMessages,
        toolCallId: pa.toolCallId,
        createdAt: Date.now(),
      });

      const metadata = JSON.stringify({
        actionCard: {
          actionId: pa.actionId,
          question: description.question,
          description: description.detail,
        },
      });

      await db.insert(messages).values({
        id: actionMsgId,
        conversationId,
        authorId: null,
        agentId,
        content: description.preface,
        role: "ai",
        metadata,
      });

      sendToConversation(memberIds, {
        type: "new_message",
        message: {
          id: actionMsgId,
          conversationId,
          authorId: null,
          agentId,
          authorName: agentName,
          content: description.preface,
          role: "ai",
          createdAt: new Date().toISOString(),
          metadata: {
            actionCard: {
              actionId: pa.actionId,
              question: description.question,
              description: description.detail,
            },
          },
        },
      });
    }

    return;
  }

  // Regular finish: save the final text
  const textContent = fullText || finalText;
  if (textContent) {
    await db.insert(messages).values({
      id: messageId,
      conversationId,
      authorId: null,
      agentId,
      content: textContent,
      role: "ai",
    });

    sendToConversation(memberIds, {
      type: "new_message",
      message: {
        id: messageId,
        conversationId,
        authorId: null,
        agentId,
        authorName: agentName,
        content: textContent,
        role: "ai",
        createdAt: new Date().toISOString(),
      },
    });

    // Auto-name conversation after first exchange
    await autoNameConversation(conversationId, db);
  }
}

async function autoNameConversation(conversationId: string, db: Database) {
  try {
    const msgCount = await db
      .select({ id: messages.id })
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .limit(3);

    if (msgCount.length !== 2) return;

    const [conv] = await db
      .select({ name: conversations.name })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    if (conv?.name && conv.name !== "New conversation") return;

    const [firstMsg] = await db
      .select({ content: messages.content })
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.createdAt))
      .limit(1);

    if (!firstMsg) return;

    const { nanoModel } = await import("./client.js");
    const nameResult = await generateText({
      model: nanoModel,
      maxTokens: 30,
      messages: [
        {
          role: "user",
          content: `Generate a 3-5 word title for this conversation based on: ${firstMsg.content}. Reply with ONLY the title, no quotes.`,
        },
      ],
    });

    const name = nameResult.text?.trim();
    if (!name) return;

    await db
      .update(conversations)
      .set({ name, updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));

    const memberIds = await getMemberIds(conversationId, db);
    sendToConversation(memberIds, {
      type: "conversation_renamed",
      conversationId,
      name,
    });
  } catch (err) {
    console.error("Auto-naming error:", err);
  }
}

/**
 * Resolve agent configuration for a conversation.
 * Returns null if no agent assigned (use defaults).
 */
async function resolveConversationAgent(conversationId: string, userId: string, db: Database) {
  const [conv] = await db
    .select({ agentId: conversations.agentId })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  if (!conv?.agentId) return null;

  const ctx: ToolContext = { db, userId, conversationId };
  const agentResult = await getToolsForAgent(conv.agentId, ctx, db);

  // Build set of custom read-only tool names
  const customReadOnlyTools = new Set<string>();
  const allCustomRows = await db.select().from(customToolsTable);
  for (const row of allCustomRows) {
    if (row.isReadOnly) customReadOnlyTools.add(row.name);
  }

  return {
    ...agentResult,
    customReadOnlyTools,
  };
}

export async function processAIMessage(
  conversationId: string,
  userId: string,
  db: Database,
) {
  // Abort any in-flight AI call for this conversation
  const existing = activeControllers.get(conversationId);
  if (existing) {
    existing.abort();
  }

  const controller = new AbortController();
  activeControllers.set(conversationId, controller);

  const memberIds = await getMemberIds(conversationId, db);

  try {
    sendToConversation(memberIds, {
      type: "ai_typing",
      conversationId,
      isTyping: true,
    });

    // Resolve agent for conversation
    const agentConfig = await resolveConversationAgent(conversationId, userId, db);

    const promptOptions = agentConfig
      ? {
          agentPromptFragments: agentConfig.systemPromptFragments,
          agentName: agentConfig.agentName,
        }
      : undefined;

    const [contextMessages, { prompt: systemPrompt, isOnboarding }] = await Promise.all([
      loadContext(conversationId, db),
      buildSystemPrompt(db, promptOptions),
    ]);

    const resolvedModel = agentConfig?.modelId ? getModel(agentConfig.modelId) : model;
    const resolvedTools = agentConfig?.tools as Record<string, unknown> | undefined;

    const resolvedAgentId = agentConfig?.agentId ?? DEFAULT_AGENT_ID;
    const resolvedAgentName = agentConfig?.agentName ?? DEFAULT_AGENT_NAME;

    await streamAIResponse(
      contextMessages,
      conversationId,
      userId,
      db,
      controller.signal,
      systemPrompt,
      isOnboarding,
      resolvedModel,
      resolvedTools,
      agentConfig?.customReadOnlyTools,
      resolvedAgentId,
      resolvedAgentName,
    );
  } catch (err: unknown) {
    if ((err as Error).name === "AbortError") return;
    console.error("AI processing error:", err);

    const errMsgId = crypto.randomUUID();
    await db.insert(messages).values({
      id: errMsgId,
      conversationId,
      authorId: null,
      agentId: DEFAULT_AGENT_ID,
      content: "I encountered an error processing your request.",
      role: "ai",
    });

    sendToConversation(memberIds, {
      type: "new_message",
      message: {
        id: errMsgId,
        conversationId,
        authorId: null,
        agentId: DEFAULT_AGENT_ID,
        authorName: DEFAULT_AGENT_NAME,
        content: "I encountered an error processing your request.",
        role: "ai",
        createdAt: new Date().toISOString(),
      },
    });
  } finally {
    activeControllers.delete(conversationId);
    sendToConversation(memberIds, {
      type: "ai_typing",
      conversationId,
      isTyping: false,
    });
  }
}

export async function processToolConfirmation(
  conversationId: string,
  userId: string,
  db: Database,
  assistantMessages: CoreMessage[],
  toolCallId: string,
  toolResult: string,
) {
  const controller = new AbortController();
  activeControllers.set(conversationId, controller);

  const memberIds = await getMemberIds(conversationId, db);

  try {
    sendToConversation(memberIds, {
      type: "ai_typing",
      conversationId,
      isTyping: true,
    });

    // Resolve agent for conversation
    const agentConfig = await resolveConversationAgent(conversationId, userId, db);

    const promptOptions = agentConfig
      ? {
          agentPromptFragments: agentConfig.systemPromptFragments,
          agentName: agentConfig.agentName,
        }
      : undefined;

    const [contextMessages, { prompt: systemPrompt, isOnboarding }] = await Promise.all([
      loadContext(conversationId, db),
      buildSystemPrompt(db, promptOptions),
    ]);

    const resolvedModel = agentConfig?.modelId ? getModel(agentConfig.modelId) : model;
    const resolvedTools = agentConfig?.tools as Record<string, unknown> | undefined;

    // Append the tool result to the context
    const followUpMessages: CoreMessage[] = [
      ...contextMessages,
      ...assistantMessages,
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId,
            result: toolResult,
          },
        ],
      },
    ];

    const resolvedAgentId = agentConfig?.agentId ?? DEFAULT_AGENT_ID;
    const resolvedAgentName = agentConfig?.agentName ?? DEFAULT_AGENT_NAME;

    await streamAIResponse(
      followUpMessages,
      conversationId,
      userId,
      db,
      controller.signal,
      systemPrompt,
      isOnboarding,
      resolvedModel,
      resolvedTools,
      agentConfig?.customReadOnlyTools,
      resolvedAgentId,
      resolvedAgentName,
    );
  } catch (err: unknown) {
    if ((err as Error).name === "AbortError") return;
    console.error("AI tool confirmation error:", err);
  } finally {
    activeControllers.delete(conversationId);
    sendToConversation(memberIds, {
      type: "ai_typing",
      conversationId,
      isTyping: false,
    });
  }
}
