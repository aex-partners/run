import { Queue, ConnectionOptions } from 'bullmq'
import { EmailQueue, QueuedEmail } from '@/contexts/email/application/ports/out/EmailQueue'

// Driven adapter for the EmailQueue port. Mirrors AEX queue/email-queue.ts:
// BullMQ "email-send" queue, 3 attempts, exponential backoff. Consumed by the
// EmailWorker driving adapter.
export class BullMqEmailQueue implements EmailQueue {
  private readonly queue: Queue

  constructor(connection: ConnectionOptions) {
    this.queue = new Queue('email-send', { connection })
  }

  async enqueue(job: QueuedEmail): Promise<void> {
    await this.queue.add('send-email', job, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5_000 },
      removeOnComplete: true,
      removeOnFail: 10,
    })
  }
}
