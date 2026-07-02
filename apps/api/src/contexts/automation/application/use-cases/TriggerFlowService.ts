import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { TriggerFlow, TriggerFlowCommand } from '@/contexts/automation/application/ports/in/TriggerFlow'
import { FlowAggregateRepository } from '@/contexts/automation/application/ports/out/FlowAggregateRepository'
import { FlowVersionRepository } from '@/contexts/automation/application/ports/out/FlowVersionRepository'
import { FlowRunRepository } from '@/contexts/automation/application/ports/out/FlowRunRepository'
import { Scheduler } from '@/contexts/automation/application/ports/out/Scheduler'
import { FlowRun } from '@/contexts/automation/domain/FlowRun'
import { FlowId, FlowVersionId } from '@/contexts/automation/domain/ids'

// `flows.execute`: resolve the version to run (published, else latest), create a
// pending run, and enqueue it for the worker. Ported from the `execute` procedure.
export class TriggerFlowService implements TriggerFlow {
  constructor(
    private readonly flows: FlowAggregateRepository,
    private readonly versions: FlowVersionRepository,
    private readonly runs: FlowRunRepository,
    private readonly scheduler: Scheduler,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: TriggerFlowCommand): Promise<Result<{ runId: string }>> {
    const flowId = FlowId.of(cmd.flowId)
    const flow = await this.flows.findById(flowId)
    if (!flow) return fail('TriggerFlow: flow not found')

    let versionId = flow.publishedVersionId
    if (!versionId) {
      const latest = await this.versions.findLatest(flowId)
      if (!latest) return fail('TriggerFlow: flow has no versions')
      versionId = latest.id.value
    }

    const payloadRaw =
      cmd.triggerPayload === undefined || cmd.triggerPayload === null
        ? null
        : JSON.stringify(cmd.triggerPayload)

    const run = FlowRun.createPending({
      id: this.runs.nextId(),
      flowId,
      flowVersionId: FlowVersionId.of(versionId),
      triggeredBy: cmd.triggeredBy,
      triggerPayloadRaw: payloadRaw,
      now: this.clock.now(),
    })
    await this.runs.save(run)
    await this.scheduler.enqueueRun(run.id.value)

    return ok({ runId: run.id.value })
  }
}
