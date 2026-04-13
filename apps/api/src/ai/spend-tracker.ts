import IORedis from "ioredis";

// Separate ioredis client for spend tracking (BullMQ's is internal to bullmq).
let client: IORedis | null = null;
function getClient(): IORedis {
  if (!client) {
    client = new IORedis(process.env.REDIS_URL ?? "redis://redis:6379", {
      maxRetriesPerRequest: null,
    });
  }
  return client;
}

function todayKey(userId: string): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  return `user:${userId}:cost:${date}`;
}

const DEFAULT_DAILY_BUDGET_USD = Number(process.env.CHAT_DAILY_BUDGET_USD ?? 5);

/**
 * Read today's accumulated Anthropic spend for the user. The counter is
 * maintained via INCRBYFLOAT on result events from the SDK; absent a value
 * we return 0 so the first request of the day passes.
 */
export async function getTodaySpendUsd(userId: string): Promise<number> {
  const raw = await getClient().get(todayKey(userId));
  return raw ? Number(raw) : 0;
}

/**
 * Throws a user-facing error when the user has already exceeded their daily
 * budget. Called at the top of handleChat before a new query is started.
 */
export async function assertUnderBudget(userId: string): Promise<void> {
  const spent = await getTodaySpendUsd(userId);
  if (spent >= DEFAULT_DAILY_BUDGET_USD) {
    throw new BudgetExceededError(spent, DEFAULT_DAILY_BUDGET_USD);
  }
}

export async function recordSpend(userId: string, costUsd: number): Promise<void> {
  if (!Number.isFinite(costUsd) || costUsd <= 0) return;
  const key = todayKey(userId);
  const c = getClient();
  // 40-day TTL so we retain a short history for inspection; the key itself
  // is day-scoped so the "today" reading is always accurate.
  await c.incrbyfloat(key, costUsd);
  await c.expire(key, 60 * 60 * 24 * 40);
}

export class BudgetExceededError extends Error {
  constructor(public readonly spentUsd: number, public readonly budgetUsd: number) {
    super(
      `Daily AI spend limit reached: $${spentUsd.toFixed(4)} / $${budgetUsd.toFixed(2)}. ` +
      `Try again tomorrow or ask an admin to raise CHAT_DAILY_BUDGET_USD.`,
    );
    this.name = "BudgetExceededError";
  }
}
