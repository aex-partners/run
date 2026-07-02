import { Scheduler } from '@/contexts/automation/application/ports/out/Scheduler'

// In-memory test double for the Scheduler. Records calls so tests can assert what
// was enqueued / scheduled without a live Redis.
export class InMemoryScheduler implements Scheduler {
  readonly enqueued: { runId: string; delayMs?: number }[] = []
  readonly polls = new Map<string, string>()

  async enqueueRun(runId: string, delayMs?: number): Promise<void> {
    this.enqueued.push({ runId, delayMs })
  }

  async schedulePolling(flowId: string, cronExpression: string): Promise<void> {
    this.polls.set(flowId, cronExpression)
  }

  async unschedulePolling(flowId: string): Promise<void> {
    this.polls.delete(flowId)
  }
}
