// Driven port for the recurring OAuth refresh job. The application only knows
// "make sure the periodic refresh is scheduled"; the adapter (adapters/out/queue)
// wraps a BullMQ repeatable job. Idempotent. The worker that consumes the job is
// a DRIVING adapter (adapters/in/worker) calling the RefreshCredential in-port.
export interface Scheduler {
  ensureRefreshSchedule(): Promise<void>
}
