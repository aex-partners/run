// Driven port for delayed-job scheduling. The application only knows "run a job
// keyed by jobId at runAt" and "cancel it". The adapter wraps BullMQ (a delayed
// job per reminder); a test double can fire synchronously. One job per reminder,
// keyed by the reminder id.
export interface Scheduler {
  schedule(jobId: string, runAt: Date): Promise<void>
  cancel(jobId: string): Promise<void>
}
