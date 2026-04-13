import type { FastifyInstance } from "fastify";
import { eq, and } from "drizzle-orm";
import { auth } from "../auth/index.js";
import { db } from "../db/index.js";
import { messages, conversationMembers } from "../db/schema/index.js";
import { sendToConversation } from "../ws/index.js";
import { handleChat } from "./chat-handler.js";
import { resolveConfirmation } from "./confirmation-broker.js";
import { assertUnderBudget, BudgetExceededError } from "./spend-tracker.js";

const CHAT_RATE_MAX = Number(process.env.CHAT_RATE_LIMIT_MAX ?? 20);
const CHAT_RATE_WINDOW = process.env.CHAT_RATE_LIMIT_WINDOW ?? "1 minute";

export function registerChatRoutes(app: FastifyInstance) {
  // Main chat endpoint: streams AI response via SSE
  app.post("/api/chat", {
    config: {
      rateLimit: { max: CHAT_RATE_MAX, timeWindow: CHAT_RATE_WINDOW },
    },
  }, async (req, reply) => {
    // Auth
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
    }
    const session = await auth.api.getSession({ headers });
    if (!session?.user) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const userId = session.user.id;
    const { prompt, conversationId } = req.body as { prompt: string; conversationId: string };

    if (!prompt || !conversationId) {
      return reply.status(400).send({ error: "Missing prompt or conversationId" });
    }

    // Verify membership
    const [member] = await db
      .select()
      .from(conversationMembers)
      .where(
        and(
          eq(conversationMembers.conversationId, conversationId),
          eq(conversationMembers.userId, userId),
        ),
      )
      .limit(1);

    if (!member) {
      return reply.status(403).send({ error: "Not a member of this conversation" });
    }

    // Daily per-user Anthropic spend cap. Throws BudgetExceededError when hit.
    try {
      await assertUnderBudget(userId);
    } catch (err) {
      if (err instanceof BudgetExceededError) {
        return reply.status(429).send({
          error: err.message,
          spentUsd: err.spentUsd,
          budgetUsd: err.budgetUsd,
        });
      }
      throw err;
    }

    // Save user message to DB
    const userMsgId = crypto.randomUUID();
    await db.insert(messages).values({
      id: userMsgId,
      conversationId,
      authorId: userId,
      content: prompt,
      role: "user",
    });

    // Broadcast user message to other members
    const memberIds = await db
      .select({ userId: conversationMembers.userId })
      .from(conversationMembers)
      .where(eq(conversationMembers.conversationId, conversationId));

    sendToConversation(
      memberIds.map((m) => m.userId),
      {
        type: "new_message",
        message: {
          id: userMsgId,
          conversationId,
          authorId: userId,
          authorName: session.user.name,
          content: prompt,
          role: "user",
          createdAt: new Date().toISOString(),
        },
      },
    );

    // Stream AI response
    reply.hijack();
    await handleChat({ conversationId, prompt, userId, reply });
  });

  // Tool confirmation endpoint
  app.post("/api/chat/confirm", async (req, reply) => {
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
    }
    const session = await auth.api.getSession({ headers });
    if (!session?.user) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    const { toolUseId, allow } = req.body as { toolUseId: string; allow: boolean };

    if (!toolUseId || typeof allow !== "boolean") {
      return reply.status(400).send({ error: "Missing toolUseId or allow" });
    }

    const found = resolveConfirmation(toolUseId, allow);
    return reply.send({ ok: found });
  });
}
