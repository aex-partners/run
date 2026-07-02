// Starts the BullMQ workers — driving adapters that pull jobs off a queue and
// call a context in-port. One Worker per queue. Returns the live workers so the
// server can close them on shutdown.
import { Worker, ConnectionOptions } from 'bullmq'
import { Redis } from 'ioredis'
import { Container } from '@/main/container'

import { makeTaskJobHandler } from '@/contexts/tasks/adapters/in/worker/TaskWorker'
import { TASK_QUEUE_NAME } from '@/contexts/tasks/adapters/out/queue/BullTaskScheduler'
import { startFlowRunWorker } from '@/contexts/automation/adapters/in/worker/FlowRunWorker'
import { startFlowPollingWorker } from '@/contexts/automation/adapters/in/worker/FlowPollingWorker'
import { EmailWorker } from '@/contexts/email/adapters/in/worker/EmailWorker'
import { SnoozeWorker } from '@/contexts/email/adapters/in/worker/SnoozeWorker'
import { makeReminderJobHandler } from '@/contexts/reminders/adapters/in/worker/ReminderWorker'
import { REMINDER_QUEUE_NAME } from '@/contexts/reminders/adapters/out/queue/BullScheduler'
import { makeCredentialsRefreshJobHandler } from '@/contexts/credentials/adapters/in/worker/CredentialsRefreshWorker'
import { CREDENTIALS_REFRESH_QUEUE_NAME } from '@/contexts/credentials/adapters/out/queue/BullCredentialsRefreshScheduler'
import { makeDigestJobHandler } from '@/contexts/notifications/adapters/in/worker/DigestWorker'
import { makeBlingSyncJobHandler } from '@/contexts/bling/adapters/in/worker/BlingSyncWorker'
import { BLING_SYNC_QUEUE_NAME } from '@/contexts/bling/adapters/out/queue/BullBlingSyncScheduler'

// Queue names that have no in-context constant.
const DIGEST_QUEUE_NAME = 'digest'
const FILE_INDEXING_QUEUE_NAME = 'file-indexing'

export async function startWorkers(container: Container, redis: Redis): Promise<Worker[]> {
  const ports = container.workerPorts
  // bullmq bundles its own ioredis copy; cast the shared connection (see container).
  const connection = redis as unknown as ConnectionOptions

  const workers: Worker[] = [
    // tasks
    new Worker(TASK_QUEUE_NAME, makeTaskJobHandler({ run: ports.runTask }), { connection }),
    // automation: flow runs + trigger polling
    startFlowRunWorker(connection, ports.runFlow),
    startFlowPollingWorker(connection, ports.pollTriggers),
    // email: delivery + snooze wake
    new EmailWorker(connection, ports.deliverEmail).start(),
    new SnoozeWorker(connection, ports.wakeEmail).start(),
    // reminders
    new Worker(REMINDER_QUEUE_NAME, makeReminderJobHandler({ fire: ports.fireReminder }), { connection }),
    // credentials auto-refresh
    new Worker(CREDENTIALS_REFRESH_QUEUE_NAME, makeCredentialsRefreshJobHandler({ refresh: ports.refreshCredential }), { connection }),
    // notifications digest
    new Worker(DIGEST_QUEUE_NAME, makeDigestJobHandler({ runDigest: ports.runDigest }), { connection }),
    // bling full-mirror sync
    new Worker(BLING_SYNC_QUEUE_NAME, makeBlingSyncJobHandler({ sync: ports.syncBlingMirror }), { connection }),
    // file indexing -> knowledge.IndexFile (extract text + store as file-content KB)
    new Worker(
      FILE_INDEXING_QUEUE_NAME,
      async (job) => {
        const data = job.data as { fileId?: string }
        if (data?.fileId) await ports.indexFile(data.fileId)
      },
      { connection },
    ),
  ]

  // Register repeatable schedules.
  await container.schedulers.credScheduler.ensureRefreshSchedule()
  await container.schedulers.blingSyncScheduler.ensureSchedule()

  return workers
}
