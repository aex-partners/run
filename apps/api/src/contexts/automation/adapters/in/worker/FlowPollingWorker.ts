import { Worker, Job } from 'bullmq'
import type { ConnectionOptions } from 'bullmq'
import { PollTriggers } from '@/contexts/automation/application/ports/in/PollTriggers'
import { FLOW_POLLING_QUEUE } from '@/contexts/automation/adapters/out/scheduler/BullMqScheduler'

// Driving adapter for the cron poll. Each repeatable tick carries a flowId; the
// worker delegates to the PollTriggers in-port (which re-reads live state and fans
// out runs). Ports `queue/flow-polling-worker.ts`.
export const makeFlowPollingJobHandler =
  (poll: PollTriggers) =>
  async (job: { data: { flowId: string } }) => {
    if (!job.data.flowId) return { runIds: [] }
    const r = await poll.execute({ flowId: job.data.flowId })
    if (!r.ok) throw new Error(`flow poll failed: ${r.error}`)
    return r.value
  }

export function startFlowPollingWorker(connection: ConnectionOptions, poll: PollTriggers): Worker {
  const handler = makeFlowPollingJobHandler(poll)
  return new Worker(
    FLOW_POLLING_QUEUE,
    async (job: Job) => handler({ data: job.data as { flowId: string } }),
    { connection, concurrency: 4 },
  )
}
