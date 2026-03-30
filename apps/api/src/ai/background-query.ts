import { query } from "@anthropic-ai/claude-agent-sdk";
import { db } from "../db/index.js";
import { messages } from "../db/schema/index.js";
import { sendToConversation } from "../ws/index.js";
import { getSessionId, saveSessionId } from "./session-store.js";
import { resolveAgentForConversation } from "./agent-resolver.js";
import { buildMcpServer } from "./mcp-server-factory.js";
import { isReadOnlyTool } from "./tool-registry.js";
import { buildSubagents } from "./subagents.js";
import type { ToolContext } from "./types.js";
import { eq } from "drizzle-orm";
import { conversationMembers } from "../db/schema/index.js";

/**
 * Run an AI query in the background (no SSE streaming).
 * Used for async tasks like setup kickoff where there's no active client connection.
 */
export async function runBackgroundQuery(opts: {
  conversationId: string;
  prompt: string;
  userId: string;
}): Promise<void> {
  const { conversationId, prompt, userId } = opts;

  try {
    const sessionId = await getSessionId(conversationId);
    const agentConfig = await resolveAgentForConversation(conversationId, userId);
    const toolContext: ToolContext = { db, userId, conversationId };
    const mcpServer = buildMcpServer({ agentConfig, toolContext });

    const members = await db
      .select({ userId: conversationMembers.userId })
      .from(conversationMembers)
      .where(eq(conversationMembers.conversationId, conversationId));
    const memberIds = members.map((m) => m.userId);

    // Send typing indicator
    sendToConversation(memberIds, { type: "ai_typing", conversationId, isTyping: true });

    const queryOptions: Record<string, unknown> = {
      systemPrompt: agentConfig.systemPrompt,
      mcpServers: { aex: mcpServer },
      allowedTools: [
        "mcp__aex__*",
        "WebSearch", "WebFetch", "ToolSearch",
        "Bash", "Read", "Write", "Edit", "Glob", "Grep",
        "Agent", "TodoWrite",
      ],
      canUseTool: async (toolName: string) => {
        if (isReadOnlyTool(toolName)) return { behavior: "allow" };
        return { behavior: "allow" };
      },
      tools: [],
      permissionMode: "allowEdits",
      maxTurns: 15,
      cwd: process.cwd(),
      thinking: { type: "adaptive" },
      model: agentConfig.modelId || "claude-sonnet-4-6",
    };

    if (sessionId) queryOptions.resume = sessionId;

    let finalText = "";
    let currentSessionId = sessionId;

    for await (const message of query({ prompt, options: queryOptions as any })) {
      if (message.type === "system" && (message as any).subtype === "init") {
        const newSessionId = (message as any).session_id as string;
        if (!currentSessionId) {
          currentSessionId = newSessionId;
          await saveSessionId(conversationId, newSessionId);
        }
      }

      if (message.type === "assistant") {
        const content = (message as any).message?.content ?? (message as any).content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === "text" && block.text) {
              finalText += block.text;
            }
          }
        }
      }
    }

    // Save AI response
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

    sendToConversation(memberIds, { type: "ai_typing", conversationId, isTyping: false });
  } catch (err) {
    console.error("Background query error:", err);
  }
}
