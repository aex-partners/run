import { Result } from '@/shared/kernel/Result'

// Driver-facing in-port for the polling worker: one scheduled tick for one flow.
// Re-reads live flow state, then for a SCHEDULE trigger creates one run, or for a
// PIECE trigger polls and fans out one run per fresh item. Returns the run ids it
// created. Ports `queue/flow-polling-worker.ts`.
export interface PollTriggersCommand {
  flowId: string
}

export interface PollTriggers {
  execute(cmd: PollTriggersCommand): Promise<Result<{ runIds: string[] }>>
}
