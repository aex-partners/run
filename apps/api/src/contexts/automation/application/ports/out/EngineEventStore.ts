import { RunEvent } from '@/contexts/automation/domain/engine/RunEvent'

// Driven port. Append-only log of ENGINE events per run (the richer counterpart
// to the skeleton's RunEventStore). Durability + resume come from replaying these
// through the engine FlowDecider.evolve.
export interface EngineEventStore {
  append(runId: string, event: RunEvent): Promise<void>
  load(runId: string): Promise<RunEvent[]>
}
