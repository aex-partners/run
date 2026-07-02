import { RunEventStore } from '@/contexts/automation/application/ports/out/RunEventStore'
import { RunEvent } from '@/contexts/automation/domain/RunEvent'

// Driven adapter. The Postgres/Redis version appends to a `flow_run_events`
// table; the contract (append/load) is identical.
export class InMemoryRunEventStore implements RunEventStore {
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
