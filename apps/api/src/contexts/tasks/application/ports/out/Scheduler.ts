// Driven port for delayed-job scheduling on the tasks queue. The application only
// knows "run a job keyed by jobId at runAt" and "cancel it"; the adapter wraps
// BullMQ (one job per task, keyed by the task id). `runAt` in the past means run
// now (delay 0) — used by retry to enqueue immediately. Mirrors AEX's
// enqueueTask / cancelTaskJob.
export interface Scheduler {
  schedule(jobId: string, runAt: Date): Promise<void>
  cancel(jobId: string): Promise<void>
}
