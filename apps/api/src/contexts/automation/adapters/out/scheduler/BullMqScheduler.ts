import { Queue } from 'bullmq'
import type { ConnectionOptions } from 'bullmq'
import { Scheduler } from '@/contexts/automation/application/ports/out/Scheduler'

export const FLOW_RUNS_QUEUE = 'flow-runs'
export const FLOW_POLLING_QUEUE = 'flow-polling'

// Driven adapter over BullMQ. Ports `queue/flow-queue.ts` (run enqueue) and
// `flow-engine/polling-scheduler.ts` (repeatable cron poll registration). The
// shared Redis connection is injected from main (built via makeRedis); this
// adapter owns the two queues.
export class BullMqScheduler implements Scheduler {
  private readonly runs: Queue
  private readonly polling: Queue

  constructor(connection: ConnectionOptions) {
    this.runs = new Queue(FLOW_RUNS_QUEUE, { connection })
    this.polling = new Queue(FLOW_POLLING_QUEUE, { connection })
  }

  async enqueueRun(runId: string, delayMs?: number): Promise<void> {
    await this.runs.add(
      'run-flow',
      { runId },
      { jobId: runId, ...(delayMs && delayMs > 0 ? { delay: delayMs } : {}) },
    )
  }

  async schedulePolling(flowId: string, cronExpression: string): Promise<void> {
    await this.polling.add(
      'poll-flow',
      { flowId },
      { jobId: `poll-${flowId}`, repeat: { pattern: cronExpression } },
    )
  }

  async unschedulePolling(flowId: string): Promise<void> {
    const repeatable = await this.polling.getRepeatableJobs()
    const match = repeatable.find((job) => job.id === `poll-${flowId}`)
    if (match) await this.polling.removeRepeatableByKey(match.key)
  }
}
