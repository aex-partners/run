import { Queue, ConnectionOptions } from 'bullmq'
import { makeRedis } from '@/platform/queue/connection'
import { Scheduler } from '@/contexts/tasks/application/ports/out/Scheduler'

// The BullMQ queue tasks fire on. The TaskWorker (a Worker over this same queue,
// created in main) consumes the `run-task` job and calls the RunTask in-port.
export const TASK_QUEUE_NAME = 'tasks'

// Driven adapter for the Scheduler out-port. Wraps a BullMQ delayed job over the
// shared Redis connection: one job per task, keyed by the task id (matches AEX's
// `enqueueTask`, where jobId === taskId). delay = max(0, runAt - now), so a runAt
// in the past (retry) enqueues immediately.
export class BullTaskScheduler implements Scheduler {
  private readonly queue: Queue

  constructor(redisUrl: string) {
    // `as ConnectionOptions`: bullmq bundles its own `ioredis` type, structurally
    // identical to the shared Redis instance but not nominally assignable across
    // the package boundary. The cast is the standard bullmq + ioredis interop.
    const connection = makeRedis(redisUrl) as unknown as ConnectionOptions
    this.queue = new Queue(TASK_QUEUE_NAME, { connection })
  }

  async schedule(jobId: string, runAt: Date): Promise<void> {
    const delay = Math.max(0, runAt.getTime() - Date.now())
    await this.queue.add(
      'run-task',
      { taskId: jobId },
      { jobId, ...(delay > 0 ? { delay } : {}) },
    )
  }

  async cancel(jobId: string): Promise<void> {
    const job = await this.queue.getJob(jobId)
    if (job) await job.remove()
  }
}
