// Shared infrastructure primitives for the composition root. Built once and passed
// to every per-context wiring builder. Holds the cross-cutting singletons (clock,
// event publisher, queue connection) and the raw platform handles (db/redis/env/auth)
// so a builder destructures exactly what it needs.
import { Redis } from 'ioredis'
import { ConnectionOptions } from 'bullmq'

import { Database } from '@/platform/db/client'
import { Env } from '@/platform/config/env'
import { Auth } from '@/platform/auth/better-auth'
import { SystemClock } from '@/platform/runtime/SystemClock'
import { WsEventPublisher } from '@/platform/events/WsEventPublisher'

export interface Infra {
  db: Database
  redis: Redis
  env: Env
  auth: Auth
  clock: SystemClock
  events: WsEventPublisher
  redisUrl: string
  encryptionKey: string
  bullConnection: ConnectionOptions
}

export function buildInfra(db: Database, redis: Redis, env: Env, auth: Auth): Infra {
  const clock = new SystemClock()
  const events = new WsEventPublisher()
  const redisUrl = env.REDIS_URL
  const encryptionKey = env.ENCRYPTION_KEY ?? 'devinsecureencryptionkey00000000'
  // bullmq bundles its own copy of ioredis; the two `Redis` types are structurally
  // identical but nominally distinct, so the shared connection is cast here.
  const bullConnection = redis as unknown as ConnectionOptions
  return { db, redis, env, auth, clock, events, redisUrl, encryptionKey, bullConnection }
}
