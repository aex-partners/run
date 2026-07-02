import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { MoveFlow, MoveFlowCommand } from '@/contexts/automation/application/ports/in/MoveFlow'
import { FlowAggregateRepository } from '@/contexts/automation/application/ports/out/FlowAggregateRepository'
import { FlowFolderRepository } from '@/contexts/automation/application/ports/out/FlowFolderRepository'
import { FlowId, FlowFolderId } from '@/contexts/automation/domain/ids'

// `flows.moveFlow`: move a flow into a folder (validated to exist) or to the root.
export class MoveFlowService implements MoveFlow {
  constructor(
    private readonly flows: FlowAggregateRepository,
    private readonly folders: FlowFolderRepository,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: MoveFlowCommand): Promise<Result<{ success: true }>> {
    const flow = await this.flows.findById(FlowId.of(cmd.flowId))
    if (!flow) return fail('MoveFlow: flow not found')

    if (cmd.folderId !== null) {
      const folder = await this.folders.findById(FlowFolderId.of(cmd.folderId))
      if (!folder) return fail('MoveFlow: folder not found')
    }

    flow.moveToFolder(cmd.folderId, this.clock.now())
    await this.flows.save(flow)
    return ok({ success: true })
  }
}
