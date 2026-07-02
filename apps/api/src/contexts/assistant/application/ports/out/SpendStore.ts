// Driven port: the per-user daily Anthropic spend counter. The Budget VO holds the
// RULE (am I over the cap); this port holds the IO (read today's total, add a
// charge). Ported from spend-tracker.ts; the Redis INCRBYFLOAT counter is one
// adapter behind it.
export interface SpendStore {
  getTodaySpendUsd(userId: string): Promise<number>
  recordSpend(userId: string, costUsd: number): Promise<void>
}
