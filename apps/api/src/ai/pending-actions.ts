import { Redis } from "ioredis";
import type { CoreMessage } from "ai";
import { env } from "../env.js";

export interface PendingAction {
  actionId: string;
  conversationId: string;
  userId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  assistantMessages: CoreMessage[];
  toolCallId: string;
  createdAt: number;
}

const parsed = new URL(env.REDIS_URL);
const redis = new Redis({
  host: parsed.hostname,
  port: parseInt(parsed.port || "6379", 10),
  password: parsed.password || undefined,
  maxRetriesPerRequest: null,
});

const PREFIX = "pending-action:";
const TTL_SECONDS = 300; // 5 min

export async function storePendingAction(action: PendingAction) {
  await redis.set(PREFIX + action.actionId, JSON.stringify(action), "EX", TTL_SECONDS);
}

export async function getPendingAction(actionId: string): Promise<PendingAction | undefined> {
  const data = await redis.get(PREFIX + actionId);
  if (!data) return undefined;
  return JSON.parse(data) as PendingAction;
}

export async function removePendingAction(actionId: string) {
  await redis.del(PREFIX + actionId);
}
