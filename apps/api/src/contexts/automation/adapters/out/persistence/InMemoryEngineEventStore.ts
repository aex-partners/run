import { EngineEventStore } from '@/contexts/automation/application/ports/out/EngineEventStore'
import { RunEvent } from '@/contexts/automation/domain/engine/RunEvent'

// In-memory test double for the engine event log. The Postgres version would
// append to a `flow_run_events` table; the contract (append/load) is identical.
export class InMemoryEngineEventStore implements EngineEventStore {
  private readonly logs = new Map<string, RunEvent[]>()

  async append(runId: string, event: RunEvent): Promise<void> {
    const log = this.logs.get(runId) ?? []
    log.push(event)
    this.logs.set(runId, log)
  }

  async load(runId: string): Promise<RunEvent[]> {
    return [...(this.logs.get(runId) ?? [])]
  }
}
