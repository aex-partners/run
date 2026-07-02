import { Queue, ConnectionOptions } from 'bullmq'
import { makeRedis } from '@/platform/queue/connection'
import { Scheduler } from '@/contexts/reminders/application/ports/out/Scheduler'

// The BullMQ queue reminders fire on. The ReminderWorker (a Worker over this same
// queue, created in main) consumes the `fire` job.
export const REMINDER_QUEUE_NAME = 'reminders'

// BullMQ job id, keyed by the reminder id (matches the source `reminder-<id>`).
const jobKey = (jobId: string): string => `reminder-${jobId}`

// Driven adapter for the Scheduler out-port. Wraps a BullMQ delayed job over the
// shared Redis connection (platform/queue): one delayed job per reminder, firing
// at scheduledFor (delay = max(0, runAt - now)). The job data carries the
// reminder id so the worker can resolve it.
export class BullScheduler implements Scheduler {
  private readonly queue: Queue

  constructor(redisUrl: string) {
    // `as ConnectionOptions`: bullmq bundles its own `ioredis` type, so the shared
    // Redis instance from platform/queue is structurally identical but not
    // nominally assignable across the package boundary. The cast is the standard
    // bullmq + ioredis interop.
    const connection = makeRedis(redisUrl) as unknown as ConnectionOptions
    this.queue = new Queue(REMINDER_QUEUE_NAME, { connection })
  }

  async schedule(jobId: string, runAt: Date): Promise<void> {
    const delay = Math.max(0, runAt.getTime() - Date.now())
    await this.queue.add(
      'fire',
      { reminderId: jobId },
      {
        jobId: jobKey(jobId),
        delay,
        attempts: 5,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    )
  }

  async cancel(jobId: string): Promise<void> {
    const job = await this.queue.getJob(jobKey(jobId))
    if (job) await job.remove()
  }
}
