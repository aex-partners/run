import { Worker, ConnectionOptions } from 'bullmq'
import { DeliverQueuedEmail } from '@/contexts/email/application/ports/in/TransactionalEmail'
import { QueuedEmail } from '@/contexts/email/application/ports/out/EmailQueue'

// Driving adapter. Ports AEX queue/email-worker.ts: a BullMQ worker on the
// "email-send" queue that hands each job to the DeliverQueuedEmail in-port
// (concurrency 5). A failed delivery throws so BullMQ applies its retry policy.
export class EmailWorker {
  constructor(
    private readonly connection: ConnectionOptions,
    private readonly deliver: DeliverQueuedEmail,
  ) {}

  start(): Worker {
    return new Worker(
      'email-send',
      async (job) => {
        const result = await this.deliver.execute(job.data as QueuedEmail)
        if (!result.ok) throw new Error(result.error)
      },
      { connection: this.connection, concurrency: 5 },
    )
  }
}
