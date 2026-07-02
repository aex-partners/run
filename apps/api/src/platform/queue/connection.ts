import { Redis } from 'ioredis'

// Shared BullMQ connection. Workers are DRIVING adapters that pull jobs and call
// a context in-port; scheduling is a DRIVEN port (JobQueue/Scheduler) whose
// adapter wraps a bullmq Queue over this connection.
export function makeRedis(url: string): Redis {
  return new Redis(url, { maxRetriesPerRequest: null })
}
