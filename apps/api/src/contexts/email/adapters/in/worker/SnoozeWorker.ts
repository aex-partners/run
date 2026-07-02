import { Worker, ConnectionOptions } from 'bullmq'
import { WakeSnoozedEmail } from '@/contexts/email/application/ports/in/SnoozeEmail'

interface SnoozeWakeJob {
  emailId: string
}

// Driving adapter. Consumes the "snooze-wake" delayed jobs booked by the
// Scheduler out-port and calls WakeSnoozedEmail, returning the message to the
// inbox. Replaces AEX's 15-minute cron scan (queue/snooze-worker.ts) with a
// per-email wake.
export class SnoozeWorker {
  constructor(
    private readonly connection: ConnectionOptions,
    private readonly wake: WakeSnoozedEmail,
  ) {}

  start(): Worker {
    return new Worker(
      'snooze-wake',
      async (job) => {
        const { emailId } = job.data as SnoozeWakeJob
        const result = await this.wake.execute({ emailId })
        if (!result.ok) throw new Error(result.error)
      },
      { connection: this.connection, concurrency: 1 },
    )
  }
}
