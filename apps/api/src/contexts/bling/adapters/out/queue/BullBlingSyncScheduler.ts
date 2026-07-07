import { Queue, ConnectionOptions } from 'bullmq'
import { makeRedis } from '@/platform/queue/connection'

// The BullMQ queue the full-mirror sync job runs on. The BlingSyncWorker (a Worker
// over this same queue, created in main) consumes the `sync` job and calls the
// SyncBlingMirror in-port.
export const BLING_SYNC_QUEUE_NAME = 'bling-sync'

// Repeatable job every 6h.
const REPEAT_JOB_ID = 'bling-sync-6h'
const REPEAT_PATTERN = '0 */6 * * *'

// One-off (manual, "Sincronizar Bling" button) job. A FIXED jobId so repeated
// button clicks never stack duplicate concurrent syncs: while a manual job is
// waiting/active BullMQ ignores a second add with the same id (no-op); once it
// finishes (removeOnComplete) a later click enqueues a fresh run.
const MANUAL_JOB_NAME = 'bling-sync-now'
const MANUAL_JOB_ID = 'bling-sync-manual'

// Sync scope the manual/repeatable job runs. Mirrors SyncBlingMirrorCommand.
export type BlingSyncScope = 'all' | 'categorias'

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

  // Enqueue a one-off manual sync (the "Sincronizar Bling" button). Returns
  // immediately: the existing BlingSyncWorker (Worker over this same queue)
  // picks the job up and runs the full mirror in the background, so an api
  // restart mid-sync no longer kills it: the worker re-processes on next boot
  // and the sync resumes safely because bling_sync_map's content-hash skips
  // records that are already up to date. The fixed jobId collapses rapid repeat
  // clicks into a single run (see MANUAL_JOB_ID).
  async enqueueNow(scope: BlingSyncScope = 'all'): Promise<void> {
    await this.queue.add(
      MANUAL_JOB_NAME,
      { scope },
      {
        jobId: MANUAL_JOB_ID,
        removeOnComplete: true,
        removeOnFail: 100,
      },
    )
  }

  // Tears the auto-sync down: drops the 6h repeatable and drains any queued
  // sync jobs. The Bling connection (OAuth credential) stays live so the direct
  // read-through API (bling.list / bling.get) keeps working, we just never
  // mirror/sync into local tables again.
  async removeSchedule(): Promise<void> {
    const repeatables = await this.queue.getRepeatableJobs()
    for (const r of repeatables) {
      if (r.id === REPEAT_JOB_ID) await this.queue.removeRepeatableByKey(r.key)
    }
    // Clear waiting + delayed sync jobs so a pending tick can't fire post-deploy.
    await this.queue.drain(true)
  }
}
