import { RunEvent } from '@/contexts/automation/domain/RunEvent'

// Driven port. Append-only log per run. Durability + resume come from replaying
// these through FlowDecider.evolve.
export interface RunEventStore {
  append(runId: string, event: RunEvent): Promise<void>
  load(runId: string): Promise<RunEvent[]>
}
