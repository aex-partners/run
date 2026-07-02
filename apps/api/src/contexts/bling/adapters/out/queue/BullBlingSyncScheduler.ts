import { Queue, ConnectionOptions } from 'bullmq'
import { makeRedis } from '@/platform/queue/connection'

// The BullMQ queue the full-mirror sync job runs on. The BlingSyncWorker (a Worker
// over this same queue, created in main) consumes the `sync` job and calls the
// SyncBlingMirror in-port.
export const BLING_SYNC_QUEUE_NAME = 'bling-sync'

// Repeatable job every 6h.
const REPEAT_JOB_ID = 'bling-sync-6h'
const REPEAT_PATTERN = '0 */6 * * *'

// Driven adapter. Ensures the single 6h repeatable sync job exists over the
// shared Redis connection (platform/queue). Idempotent.
export class BullBlingSyncScheduler {
  private readonly queue: Queue

  constructor(redisUrl: string) {
    // `as ConnectionOptions`: bullmq bundles its own `ioredis` type, so the shared
    // Redis instance from platform/queue is structurally identical but not
    // nominally assignable across the package boundary. Standard bullmq interop.
    const connection = makeRedis(redisUrl) as unknown as ConnectionOptions
    this.queue = new Queue(BLING_SYNC_QUEUE_NAME, { connection })
  }

  async ensureSchedule(): Promise<void> {
    const repeatables = await this.queue.getRepeatableJobs()
    if (repeatables.some((r) => r.id === REPEAT_JOB_ID)) return

    await this.queue.add(
      'sync',
      {},
      {
        jobId: REPEAT_JOB_ID,
        repeat: { pattern: REPEAT_PATTERN },
        removeOnComplete: true,
        removeOnFail: 50,
      },
    )
  }
}
