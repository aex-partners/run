import { Result, ok } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import { PollTriggers, PollTriggersCommand } from '@/contexts/automation/application/ports/in/PollTriggers'
import { FlowAggregateRepository } from '@/contexts/automation/application/ports/out/FlowAggregateRepository'
import { FlowVersionRepository } from '@/contexts/automation/application/ports/out/FlowVersionRepository'
import { FlowRunRepository } from '@/contexts/automation/application/ports/out/FlowRunRepository'
import { Scheduler } from '@/contexts/automation/application/ports/out/Scheduler'
import { TriggerRegistry } from '@/contexts/automation/application/ports/out/TriggerRegistry'
import { FlowRun } from '@/contexts/automation/domain/FlowRun'
import { FlowId, FlowVersionId } from '@/contexts/automation/domain/ids'
import { classifyTrigger } from '@/contexts/automation/domain/TriggerConfig'

// One scheduled poll tick for one flow (ported from `flow-polling-worker.ts`). It
// re-reads LIVE flow state every tick (never trusts the payload): a flow disabled
// or unpublished since the repeatable job was registered must not produce runs.
// SCHEDULE => one run; PIECE => one run per fresh item (dedupe in the registry
// adapter). Returns the run ids created this tick.
export class PollTriggersService implements PollTriggers {
  constructor(
    private readonly flows: FlowAggregateRepository,
    private readonly versions: FlowVersionRepository,
    private readonly runs: FlowRunRepository,
    private readonly scheduler: Scheduler,
    private readonly triggers: TriggerRegistry,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: PollTriggersCommand): Promise<Result<{ runIds: string[] }>> {
    const flowId = FlowId.of(cmd.flowId)
    const flow = await this.flows.findById(flowId)
    if (!flow || !flow.isEnabled() || !flow.publishedVersionId) return ok({ runIds: [] })

    const version = await this.versions.findById(FlowVersionId.of(flow.publishedVersionId))
    if (!version) return ok({ runIds: [] })
    const parsed = version.parseTrigger()
    if (!parsed.ok) return ok({ runIds: [] })

    const plan = classifyTrigger(parsed.value)

    if (plan.kind === 'cron') {
      const runId = await this.createRun(flowId, version.id, 'schedule', null)
      return ok({ runIds: [runId] })
    }

    if (plan.kind === 'event') {
      if (!plan.pieceName || !plan.triggerName) return ok({ runIds: [] })
      const { items } = await this.triggers.poll({
        pieceName: plan.pieceName,
        triggerName: plan.triggerName,
        flowId: flowId.value,
        input: parsed.value.settings.input ?? {},
      })
      const runIds: string[] = []
      for (const item of items) {
        runIds.push(await this.createRun(flowId, version.id, 'piece', JSON.stringify(item)))
      }
      return ok({ runIds })
    }

    return ok({ runIds: [] })
  }

  private async createRun(
    flowId: FlowId,
    versionId: FlowVersionId,
    triggeredBy: string,
    triggerPayloadRaw: string | null,
  ): Promise<string> {
    const run = FlowRun.createPending({
      id: this.runs.nextId(),
      flowId,
      flowVersionId: versionId,
      triggeredBy,
      triggerPayloadRaw,
      now: this.clock.now(),
    })
    await this.runs.save(run)
    await this.scheduler.enqueueRun(run.id.value)
    return run.id.value
  }
}
