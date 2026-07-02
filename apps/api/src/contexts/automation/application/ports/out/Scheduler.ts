// Driven port over the job queue (BullMQ in the AEX source). The application asks
// to run a flow now/later and to register or drop a flow's cron poll; the adapter
// owns the queue. Ports `queue/flow-queue.ts` + `flow-engine/polling-scheduler.ts`.
export interface Scheduler {
  // Enqueue a run for the worker. `delayMs` defers it (used by piece triggers).
  enqueueRun(runId: string, delayMs?: number): Promise<void>
  // Register a repeatable cron poll for a flow (SCHEDULE / POLLING triggers).
  schedulePolling(flowId: string, cronExpression: string): Promise<void>
  // Drop a flow's repeatable poll (no-op if none).
  unschedulePolling(flowId: string): Promise<void>
}
