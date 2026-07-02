import { Result } from '@/shared/kernel/Result'

// Driving port called by the TaskWorker when a queued job fires. Drives the full
// execution: skip non-pending, surface human/reminder tasks, or run the budgeted
// agentic loop for AI tasks. `ran` reports whether the AI runner actually
// executed (false for skipped or surfaced tasks).
export interface RunTaskCommand {
  taskId: string
}

export interface RunTask {
  execute(cmd: RunTaskCommand): Promise<Result<{ ran: boolean }>>
}
