import { query, type CanUseTool } from "@anthropic-ai/claude-agent-sdk";
import type { FastifyReply } from "fastify";
import { db } from "../db/index.js";
import { messages } from "../db/schema/index.js";
import { sendToConversation } from "../ws/index.js";
import { getSessionId, saveSessionId } from "./session-store.js";
import { resolveAgentForConversation } from "./agent-resolver.js";
import { buildMcpServer } from "./mcp-server-factory.js";
import { isReadOnlyTool } from "./tool-registry.js";
import { requestConfirmation, cancelPendingForConversation } from "./confirmation-broker.js";
import { buildSubagents } from "./subagents.js";
import type { SSEEvent, ToolContext } from "./types.js";

function sendSSE(reply: FastifyReply, event: SSEEvent) {
  try {
    reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
  } catch {
    // Client disconnected
  }
}

async function getMemberIds(conversationId: string): Promise<string[]> {
  const { conversationMembers } = await import("../db/schema/index.js");
  const { eq } = await import("drizzle-orm");
  const members = await db
    .select({ userId: conversationMembers.userId })
    .from(conversationMembers)
    .where(eq(conversationMembers.conversationId, conversationId));
  return members.map((m) => m.userId);
}

export async function handleChat(opts: {
  conversationId: string;
  prompt: string;
  userId: string;
  reply: FastifyReply;
}): Promise<void> {
  const { conversationId, prompt, userId, reply } = opts;

  // Set SSE headers
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  });

  // Clean up pending confirmations on client disconnect
  reply.raw.on("close", () => {
    cancelPendingForConversation(conversationId);
  });

  try {
    // Load session and agent config
    const sessionId = await getSessionId(conversationId);
    const agentConfig = await resolveAgentForConversation(conversationId, userId);
    const memberIds = await getMemberIds(conversationId);

    const toolContext: ToolContext = { db, userId, conversationId };
    const mcpServer = buildMcpServer({ agentConfig, toolContext });

    // Build canUseTool for confirmation of mutating tools
    const canUseTool: CanUseTool = async (toolName, input, { toolUseID }) => {
      if (isReadOnlyTool(toolName)) {
        return { behavior: "allow" };
      }

      // Mutating tool: ask user for confirmation
      const description = `Execute ${toolName.replace("mcp__aex__", "")}?`;
      sendSSE(reply, {
        type: "tool_confirmation_required",
        toolUseId: toolUseID,
        toolName: toolName.replace("mcp__aex__", ""),
        input: input as Record<string, unknown>,
        description,
      });

      const allowed = await requestConfirmation(toolUseID, toolName, conversationId);
      return allowed
        ? { behavior: "allow" }
        : { behavior: "deny", message: "User rejected this action." };
    };

    // Build query options
    const queryOptions: Record<string, unknown> = {
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
      includePartialMessages: true,
      cwd: process.cwd(),
      // Adaptive thinking: let Claude decide when and how deeply to reason
      thinking: { type: "adaptive" },
    };

    // Use agent model if set, otherwise default to claude-sonnet-4-6
    queryOptions.model = agentConfig.modelId || "claude-sonnet-4-6";

    console.log(`[chat] Model: ${queryOptions.model}, AllowedTools: ${JSON.stringify(queryOptions.allowedTools)}, Resume: ${!!sessionId}`);

    if (sessionId) {
      queryOptions.resume = sessionId;
    }

    // Run the agent
    let finalText = "";
    let textFromStreaming = false;
    let currentSessionId = sessionId;
    // Track streaming tool inputs (accumulated from input_json_delta events)
    const streamingToolInputs = new Map<string, { name: string; json: string }>();
    // Track tools already sent via streaming to avoid duplicates from assistant message
    const sentToolIds = new Set<string>();

    for await (const message of query({ prompt, options: queryOptions as any })) {
      const msgType = message.type;
      const msgSubtype = (message as any).subtype;
      if (msgType !== "stream_event") {
        console.log(`[chat] Message: type=${msgType} subtype=${msgSubtype || ""}`);
      }

      // Log tool usage for debugging
      if (message.type === "assistant") {
        const content = (message as any).message?.content ?? (message as any).content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === "tool_use") {
              console.log(`[chat] Tool call: ${block.name} input=${JSON.stringify(block.input).slice(0, 200)}`);
            }
          }
        }
      }

      // Session init
      if (message.type === "system" && (message as any).subtype === "init") {
        const newSessionId = (message as any).session_id as string;
        if (!currentSessionId) {
          currentSessionId = newSessionId;
          await saveSessionId(conversationId, newSessionId);
        }
        sendSSE(reply, {
          type: "session_init",
          sessionId: newSessionId,
          agentName: agentConfig.name,
        });
      }

      // Streaming text deltas
      if (message.type === "stream_event") {
        const event = (message as any).event;
        if (event?.type === "content_block_delta" && event?.delta?.type === "text_delta") {
          sendSSE(reply, { type: "text_delta", delta: event.delta.text });
          finalText += event.delta.text;
          textFromStreaming = true;
        }
        // Thinking deltas (adaptive thinking / extended thinking)
        if (event?.type === "content_block_delta" && event?.delta?.type === "thinking_delta") {
          sendSSE(reply, { type: "thinking_delta", delta: event.delta.thinking });
        }
        if (event?.type === "content_block_start" && event?.content_block?.type === "tool_use") {
          const toolId = event.content_block.id;
          const toolName = (event.content_block.name as string).replace("mcp__aex__", "");
          streamingToolInputs.set(toolId, { name: toolName, json: "" });
          // Don't send tool_start yet, wait for input to accumulate
        }
        // Accumulate input JSON deltas
        if (event?.type === "content_block_delta" && event?.delta?.type === "input_json_delta") {
          // Find the tool this belongs to (it's the last one in the map that isn't complete)
          for (const [id, data] of streamingToolInputs) {
            if (!sentToolIds.has(id)) {
              data.json += event.delta.partial_json ?? "";
              break;
            }
          }
        }
        // When content block stops, send the tool_start with full input
        if (event?.type === "content_block_stop") {
          for (const [id, data] of streamingToolInputs) {
            if (!sentToolIds.has(id)) {
              let parsedInput: Record<string, unknown> = {};
              try {
                parsedInput = JSON.parse(data.json || "{}");
              } catch { /* empty */ }
              sendSSE(reply, {
                type: "tool_start",
                toolUseId: id,
                toolName: data.name,
                input: parsedInput,
              });
              sentToolIds.add(id);
              break;
            }
          }
        }
      }

      // Complete assistant message (non-streaming)
      if (message.type === "assistant") {
        const content = (message as any).message?.content ?? (message as any).content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === "text" && block.text && !textFromStreaming) {
              finalText += block.text;
            }
            if (block.type === "tool_use" && !sentToolIds.has(block.id)) {
              sendSSE(reply, {
                type: "tool_start",
                toolUseId: block.id,
                toolName: (block.name as string).replace("mcp__aex__", ""),
                input: block.input as Record<string, unknown>,
              });
              sentToolIds.add(block.id);
            }
          }
        }
      }

      // Tool results - from "user" messages (SDK sends tool results as user role)
      if (message.type === "user") {
        const content = (message as any).message?.content ?? (message as any).content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === "tool_result") {
              sendSSE(reply, {
                type: "tool_result",
                toolUseId: block.tool_use_id,
                result: block.content,
                isError: block.is_error ?? false,
              });
            }
          }
        }
      }

      // Tool results - might come as "tool_result" type directly
      if (message.type === "tool_result") {
        sendSSE(reply, {
          type: "tool_result",
          toolUseId: (message as any).tool_use_id ?? (message as any).id ?? "",
          result: (message as any).content ?? (message as any).output,
          isError: (message as any).is_error ?? false,
        });
      }

      // Final result
      if (message.type === "result") {
        const resultMsg = message as any;
        currentSessionId = resultMsg.session_id ?? currentSessionId;

        sendSSE(reply, {
          type: "result",
          sessionId: currentSessionId ?? "",
          totalCostUsd: resultMsg.total_cost_usd,
          numTurns: resultMsg.num_turns,
        });
      }
    }

    // Persist session ID if it changed
    if (currentSessionId && currentSessionId !== sessionId) {
      await saveSessionId(conversationId, currentSessionId);
    }

    // Save AI response to DB
    if (finalText.trim()) {
      const aiMsgId = crypto.randomUUID();
      await db.insert(messages).values({
        id: aiMsgId,
        conversationId,
        authorId: null,
        agentId: agentConfig.id === "default" ? null : agentConfig.id,
        content: finalText.trim(),
        role: "ai",
      });

      sendToConversation(memberIds, {
        type: "new_message",
        message: {
          id: aiMsgId,
          conversationId,
          authorId: null,
          authorName: agentConfig.name,
          content: finalText.trim(),
          role: "ai",
          createdAt: new Date().toISOString(),
        },
      });
    }
  } catch (err) {
    console.error("Chat handler error:", err);
    sendSSE(reply, {
      type: "error",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  } finally {
    reply.raw.write("data: [DONE]\n\n");
    reply.raw.end();
  }
}
