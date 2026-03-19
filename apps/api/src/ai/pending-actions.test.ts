import { describe, it, expect, afterAll } from "vitest";
import { Redis } from "ioredis";

// Pending actions use the module-level Redis from env.
// Since setup.ts loads .env.test, the module will connect to the test Redis.
import {
  storePendingAction,
  getPendingAction,
  removePendingAction,
  type PendingAction,
} from "./pending-actions.js";

function makePendingAction(overrides?: Partial<PendingAction>): PendingAction {
  return {
    actionId: "pa-test-" + crypto.randomUUID().slice(0, 8),
    conversationId: "conv-test-001",
    userId: "user-test-001",
    toolName: "insert_record",
    toolInput: { entity_id_or_name: "clientes", data: { nome: "Test" } },
    assistantMessages: [],
    toolCallId: "tc-test-001",
    createdAt: Date.now(),
    ...overrides,
  };
}

describe("pending-actions (Redis integration)", () => {
  const createdIds: string[] = [];

  afterAll(async () => {
    // Cleanup created keys
    for (const id of createdIds) {
      await removePendingAction(id);
    }
  });

  it("stores and retrieves a pending action", async () => {
    const action = makePendingAction();
    createdIds.push(action.actionId);

    await storePendingAction(action);
    const retrieved = await getPendingAction(action.actionId);

    expect(retrieved).toBeDefined();
    expect(retrieved!.actionId).toBe(action.actionId);
    expect(retrieved!.toolName).toBe("insert_record");
    expect(retrieved!.toolInput).toEqual(action.toolInput);
  });

  it("removes pending action so get returns undefined", async () => {
    const action = makePendingAction();
    createdIds.push(action.actionId);

    await storePendingAction(action);
    await removePendingAction(action.actionId);

    const retrieved = await getPendingAction(action.actionId);
    expect(retrieved).toBeUndefined();
  });

  it("has TTL configured on stored keys", async () => {
    const action = makePendingAction();
    createdIds.push(action.actionId);

    await storePendingAction(action);

    // Check TTL directly via Redis
    const parsed = new URL(process.env.REDIS_URL!);
    const redis = new Redis({
      host: parsed.hostname,
      port: parseInt(parsed.port || "6379", 10),
      password: parsed.password || undefined,
      maxRetriesPerRequest: null,
    });

    try {
      const ttl = await redis.ttl(`pending-action:${action.actionId}`);
      // TTL should be between 1 and 300 seconds
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(300);
    } finally {
      await redis.quit();
    }
  });
});
