import { Worker, Job } from 'bullmq'
import type { ConnectionOptions } from 'bullmq'
import { RunFlow } from '@/contexts/automation/application/ports/in/RunFlow'
import { FLOW_RUNS_QUEUE } from '@/contexts/automation/adapters/out/scheduler/BullMqScheduler'

// Driving adapter. A BullMQ worker is just ANOTHER caller of the RunFlow in-port,
// symmetric to the HTTP controller. Ports `queue/flow-worker.ts`: the worker pulls
// a run id and delegates the whole execute-and-persist to the use case.
export const makeFlowRunJobHandler =
  (runFlow: RunFlow) =>
  async (job: { data: { runId: string } }) => {
    const r = await runFlow.execute({ runId: job.data.runId })
    if (!r.ok) throw new Error(`flow run failed: ${r.error}`)
    return r.value
  }

export function startFlowRunWorker(connection: ConnectionOptions, runFlow: RunFlow): Worker {
  const handler = makeFlowRunJobHandler(runFlow)
  return new Worker(
    FLOW_RUNS_QUEUE,
    async (job: Job) => handler({ data: job.data as { runId: string } }),
    { connection, concurrency: 2 },
  )
}
