import { Result } from '@/shared/kernel/Result'

// Driver-facing in-port for the BullMQ flow worker: load a pending/running run,
// execute its version through the engine interpreter, and persist the outcome.
// Ports `queue/flow-worker.ts`.
export interface RunFlowCommand {
  runId: string
}

export interface RunFlowResult {
  status: 'succeeded' | 'failed' | 'skipped'
  error?: string
}

export interface RunFlow {
  execute(cmd: RunFlowCommand): Promise<Result<RunFlowResult>>
}
