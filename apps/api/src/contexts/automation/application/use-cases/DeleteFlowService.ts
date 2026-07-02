import { Result, ok } from '@/shared/kernel/Result'
import { DeleteFlow, DeleteFlowCommand } from '@/contexts/automation/application/ports/in/DeleteFlow'
import { FlowAggregateRepository } from '@/contexts/automation/application/ports/out/FlowAggregateRepository'
import { FlowId } from '@/contexts/automation/domain/ids'

// `flows.delete`. Versions/runs cascade at the schema level.
export class DeleteFlowService implements DeleteFlow {
  constructor(private readonly flows: FlowAggregateRepository) {}

  async execute(cmd: DeleteFlowCommand): Promise<Result<{ success: true }>> {
    await this.flows.delete(FlowId.of(cmd.id))
    return ok({ success: true })
  }
}
