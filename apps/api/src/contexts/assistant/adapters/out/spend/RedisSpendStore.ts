import { Redis } from 'ioredis'
import { SpendStore } from '@/contexts/assistant/application/ports/out/SpendStore'

// Driven adapter for SpendStore. Ported 1:1 from spend-tracker.ts. Maintains a
// day-scoped INCRBYFLOAT counter per user with a short TTL for inspection. The
// daily-budget RULE lives in the Budget VO; this adapter is pure IO. main injects
// the shared Redis connection (platform/queue/connection makeRedis).
export class RedisSpendStore implements SpendStore {
  constructor(private readonly redis: Redis) {}

  private todayKey(userId: string): string {
    const date = new Date().toISOString().slice(0, 10)
    return `user:${userId}:cost:${date}`
  }

  async getTodaySpendUsd(userId: string): Promise<number> {
    const raw = await this.redis.get(this.todayKey(userId))
    return raw ? Number(raw) : 0
  }

  async recordSpend(userId: string, costUsd: number): Promise<void> {
    if (!Number.isFinite(costUsd) || costUsd <= 0) return
    const key = this.todayKey(userId)
    // 40-day TTL so we keep a short history; the key itself is day-scoped so
    // "today" is always accurate.
    await this.redis.incrbyfloat(key, costUsd)
    await this.redis.expire(key, 60 * 60 * 24 * 40)
  }
}
