import { env } from "../env.js";

// Parse REDIS_URL into connection options for BullMQ
// BullMQ bundles its own ioredis, so we pass plain options instead of an instance
function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || "6379", 10),
    password: parsed.password || undefined,
    maxRetriesPerRequest: null as null,
  };
}

export const redisConnection = parseRedisUrl(env.REDIS_URL);
