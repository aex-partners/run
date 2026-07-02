import { Queue, ConnectionOptions } from 'bullmq'
import { Scheduler, SnoozeWakeRequest } from '@/contexts/email/application/ports/out/Scheduler'

// Driven adapter for the Scheduler port. Books a BullMQ delayed job on the
// "snooze-wake" queue keyed by the email id (so re-snoozing replaces the prior
// wake). The SnoozeWorker driving adapter consumes it. Replaces AEX's
// 15-minute cron scan with a precise per-email delay.
export class BullMqSnoozeScheduler implements Scheduler {
  private readonly queue: Queue

  constructor(connection: ConnectionOptions) {
    this.queue = new Queue('snooze-wake', { connection })
  }

  async scheduleSnoozeWake(request: SnoozeWakeRequest): Promise<void> {
    const delay = Math.max(0, request.wakeAt.getTime() - Date.now())
    await this.queue.add(
      'wake',
      { emailId: request.emailId },
      {
        jobId: `snooze-wake:${request.emailId}`,
        delay,
        removeOnComplete: true,
        removeOnFail: 10,
      },
    )
  }
}
