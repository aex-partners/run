import { Queue, ConnectionOptions } from 'bullmq'
import { FileIndexingQueue, FileIndexingRequest } from '@/contexts/files/application/ports/out/FileIndexingQueue'

// Driven adapter for the FileIndexingQueue out-port. Mirrors AEX's
// file-indexing-queue (BullMQ "file-indexing", 3 attempts, exponential backoff).
// This is the current ACL bridge toward the knowledge context; when knowledge
// exposes an indexing in-port, main can swap this for a direct bridge without
// touching the use case.
export class BullMqFileIndexingQueue implements FileIndexingQueue {
  private readonly queue: Queue

  constructor(connection: ConnectionOptions) {
    this.queue = new Queue('file-indexing', { connection })
  }

  async enqueue(request: FileIndexingRequest): Promise<void> {
    await this.queue.add('file-indexing', request, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5_000 },
      removeOnComplete: true,
      removeOnFail: 10,
    })
  }
}
