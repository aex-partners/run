import { Queue, ConnectionOptions } from 'bullmq'
import { makeRedis } from '@/platform/queue/connection'
import { Scheduler } from '@/contexts/credentials/application/ports/out/Scheduler'

// The BullMQ queue the OAuth refresh job runs on. The CredentialsRefreshWorker (a
// Worker over this same queue, created in main) consumes the `refresh` job and
// calls the RefreshCredential in-port.
export const CREDENTIALS_REFRESH_QUEUE_NAME = 'credentials-refresh'

// Weekly repeatable job: Sunday 03:00 UTC (matches the source cron).
const REPEAT_JOB_ID = 'credentials-refresh-weekly'
const REPEAT_PATTERN = '0 3 * * 0'

// Driven adapter for the Scheduler out-port. Ensures the single weekly repeatable
// job exists over the shared Redis connection (platform/queue). Idempotent.
export class BullCredentialsRefreshScheduler implements Scheduler {
  private readonly queue: Queue

  constructor(redisUrl: string) {
    // `as ConnectionOptions`: bullmq bundles its own `ioredis` type, so the shared
    // Redis instance from platform/queue is structurally identical but not
    // nominally assignable across the package boundary. Standard bullmq interop.
    const connection = makeRedis(redisUrl) as unknown as ConnectionOptions
    this.queue = new Queue(CREDENTIALS_REFRESH_QUEUE_NAME, { connection })
  }

  async ensureRefreshSchedule(): Promise<void> {
    const repeatables = await this.queue.getRepeatableJobs()
    if (repeatables.some((r) => r.id === REPEAT_JOB_ID)) return

    await this.queue.add(
      'refresh',
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
