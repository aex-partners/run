import { Result, ok } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { CreateFlow, CreateFlowCommand } from '@/contexts/automation/application/ports/in/CreateFlow'
import { FlowAggregateRepository } from '@/contexts/automation/application/ports/out/FlowAggregateRepository'
import { FlowVersionRepository } from '@/contexts/automation/application/ports/out/FlowVersionRepository'
import { Flow } from '@/contexts/automation/domain/FlowAggregate'
import { FlowVersion } from '@/contexts/automation/domain/FlowVersion'

// The default empty trigger a new draft starts with (ported from `flows.create`).
const DEFAULT_TRIGGER = JSON.stringify({
  name: 'trigger',
  displayName: 'Trigger',
  type: 'EMPTY',
  valid: true,
  settings: {},
})

export class CreateFlowService implements CreateFlow {
  constructor(
    private readonly flows: FlowAggregateRepository,
    private readonly versions: FlowVersionRepository,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: CreateFlowCommand): Promise<Result<{ id: string; versionId: string }>> {
    const now = this.clock.now()
    const flow = Flow.create({ id: this.flows.nextId(), createdBy: cmd.createdBy, now })
    await this.flows.save(flow)

    const version = FlowVersion.createDraft({
      id: this.versions.nextId(),
      flowId: flow.id,
      displayName: cmd.displayName,
      triggerRaw: DEFAULT_TRIGGER,
      valid: false,
      now,
    })
    await this.versions.save(version)

    return ok({ id: flow.id.value, versionId: version.id.value })
  }
}
