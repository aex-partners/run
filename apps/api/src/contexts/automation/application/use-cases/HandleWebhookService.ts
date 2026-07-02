import { Result, ok, fail } from '@/shared/kernel/Result'
import { Clock } from '@/shared/kernel/Clock'
import {
  HandleWebhook,
  HandleWebhookCommand,
  HandleWebhookError,
} from '@/contexts/automation/application/ports/in/HandleWebhook'
import { FlowAggregateRepository } from '@/contexts/automation/application/ports/out/FlowAggregateRepository'
import { FlowVersionRepository } from '@/contexts/automation/application/ports/out/FlowVersionRepository'
import { FlowRunRepository } from '@/contexts/automation/application/ports/out/FlowRunRepository'
import { Scheduler } from '@/contexts/automation/application/ports/out/Scheduler'
import { FlowRun } from '@/contexts/automation/domain/FlowRun'
import { FlowId, FlowVersionId } from '@/contexts/automation/domain/ids'
import { TriggerType } from '@/contexts/automation/domain/FlowDsl'

// Inbound webhook delivery (ported from `webhook-handler.ts`). Verifies the flow is
// enabled, published and webhook-triggered, then creates a running run and enqueues
// it. Errors carry an HTTP status for the driving adapter.
export class HandleWebhookService implements HandleWebhook {
  constructor(
    private readonly flows: FlowAggregateRepository,
    private readonly versions: FlowVersionRepository,
    private readonly runs: FlowRunRepository,
    private readonly scheduler: Scheduler,
    private readonly clock: Clock,
  ) {}

  async execute(cmd: HandleWebhookCommand): Promise<Result<{ runId: string }, HandleWebhookError>> {
    const flowId = FlowId.of(cmd.flowId)
    const flow = await this.flows.findById(flowId)
    if (!flow) return fail({ error: 'Flow not found', status: 404 })
    if (!flow.isEnabled()) return fail({ error: 'Flow is not enabled', status: 400 })
    if (!flow.publishedVersionId) return fail({ error: 'Flow has no published version', status: 400 })

    const version = await this.versions.findById(FlowVersionId.of(flow.publishedVersionId))
    if (!version) return fail({ error: 'Published version not found', status: 404 })

    const parsed = version.parseTrigger()
    if (!parsed.ok) return fail({ error: 'Published version trigger is invalid', status: 400 })
    if (parsed.value.type !== TriggerType.WEBHOOK) {
      return fail({ error: 'Flow trigger is not a webhook', status: 400 })
    }

    const now = this.clock.now()
    const run = FlowRun.createPending({
      id: this.runs.nextId(),
      flowId,
      flowVersionId: FlowVersionId.of(flow.publishedVersionId),
      triggeredBy: 'webhook',
      triggerPayloadRaw: JSON.stringify(cmd.payload),
      now,
    })
    run.start(now) // source inserts the webhook run already "running"
    await this.runs.save(run)
    await this.scheduler.enqueueRun(run.id.value)

    return ok({ runId: run.id.value })
  }
}
