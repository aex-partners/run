import { Result, ok, fail } from '@/shared/kernel/Result'
import { Json } from '@/shared/domain/Json'
import { StartFlow, StartFlowCommand } from '@/contexts/automation/application/ports/in/StartFlow'
import { FlowRepository } from '@/contexts/automation/application/ports/out/FlowRepository'
import { FlowInterpreter } from '@/contexts/automation/application/use-cases/FlowInterpreter'
import { FlowId } from '@/contexts/automation/domain/ids'

export class StartFlowService implements StartFlow {
  constructor(
    private readonly flows: FlowRepository,
    private readonly interpreter: FlowInterpreter,
  ) {}

  async execute(cmd: StartFlowCommand): Promise<Result<{ runId: string; status: string; output: Json }>> {
    const flow = await this.flows.findById(FlowId.of(cmd.flowId))
    if (!flow) return fail('StartFlow: flow not found')

    const runId = this.flows.nextRunId()
    const state = await this.interpreter.run(flow, runId.value, cmd.input)
    if (state.status === 'failed') return fail(state.error ?? 'StartFlow: run failed')
    return ok({ runId: runId.value, status: state.status, output: state.output })
  }
}
