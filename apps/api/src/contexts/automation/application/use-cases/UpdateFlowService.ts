import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { UpdateFlow, UpdateFlowCommand } from '@/contexts/automation/application/ports/in/UpdateFlow'
import { FlowAggregateRepository } from '@/contexts/automation/application/ports/out/FlowAggregateRepository'
import { TriggerLifecycleService } from '@/contexts/automation/application/use-cases/TriggerLifecycleService'
import { FlowId } from '@/contexts/automation/domain/ids'

// `flows.update`: apply status/folder changes and drive the trigger lifecycle on a
// status change (enable -> register trigger; disable -> unregister).
export class UpdateFlowService implements UpdateFlow {
  constructor(
    private readonly flows: FlowAggregateRepository,
    private readonly lifecycle: TriggerLifecycleService,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: UpdateFlowCommand): Promise<Result<{ success: true }>> {
    const id = FlowId.of(cmd.id)
    const flow = await this.flows.findById(id)
    if (!flow) return fail('UpdateFlow: flow not found')

    const now = this.clock.now()
    if (cmd.folderId !== undefined) flow.moveToFolder(cmd.folderId, now)
    if (cmd.status === 'enabled') flow.enable(now)
    else if (cmd.status === 'disabled') flow.disable(now)

    await this.flows.save(flow)

    if (cmd.status === 'enabled') await this.lifecycle.enable(id)
    else if (cmd.status === 'disabled') await this.lifecycle.disable(id)

    return ok({ success: true })
  }
}
