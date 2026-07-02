import { FlowId, FlowVersionId } from '@/contexts/automation/domain/ids'
import { classifyTrigger } from '@/contexts/automation/domain/TriggerConfig'
import { FlowAggregateRepository } from '@/contexts/automation/application/ports/out/FlowAggregateRepository'
import { FlowVersionRepository } from '@/contexts/automation/application/ports/out/FlowVersionRepository'
import { Scheduler } from '@/contexts/automation/application/ports/out/Scheduler'
import { TriggerRegistry } from '@/contexts/automation/application/ports/out/TriggerRegistry'

// Default poll cadence for a PIECE polling trigger that does not declare its own
// schedule. Matches the ActivePieces platform default. Ported from
// `flow-engine/trigger-lifecycle.ts`.
const DEFAULT_POLL_CRON = '*/5 * * * *'

// Internal application service (not an in-port). Reads the published version's
// trigger and registers/unregisters the matching schedule or piece subscription
// when a flow is enabled/disabled. Ported 1:1 from `trigger-lifecycle.ts`.
export class TriggerLifecycleService {
  constructor(
    private readonly flows: FlowAggregateRepository,
    private readonly versions: FlowVersionRepository,
    private readonly scheduler: Scheduler,
    private readonly triggers: TriggerRegistry,
  ) {}

  async enable(flowId: FlowId): Promise<void> {
    const flow = await this.flows.findById(flowId)
    if (!flow || !flow.publishedVersionId) return

    const version = await this.versions.findById(FlowVersionId.of(flow.publishedVersionId))
    if (!version) return
    const parsed = version.parseTrigger()
    if (!parsed.ok) return

    const plan = classifyTrigger(parsed.value)
    switch (plan.kind) {
      case 'cron':
        if (plan.cron) await this.scheduler.schedulePolling(flowId.value, plan.cron)
        break
      case 'event': {
        if (!plan.pieceName || !plan.triggerName) return
        const result = await this.triggers.enable({
          pieceName: plan.pieceName,
          triggerName: plan.triggerName,
          flowId: flowId.value,
          input: parsed.value.settings.input ?? {},
        })
        // Only POLLING strategies need a repeatable poll job; webhook-style
        // triggers register themselves in onEnable and deliver via their route.
        if (result.strategy === 'POLLING') {
          await this.scheduler.schedulePolling(flowId.value, result.scheduledCron ?? DEFAULT_POLL_CRON)
        }
        break
      }
      case 'webhook':
      case 'polling':
      case 'empty':
        break
    }
  }

  async disable(flowId: FlowId): Promise<void> {
    const flow = await this.flows.findById(flowId)
    if (!flow || !flow.publishedVersionId) {
      await this.scheduler.unschedulePolling(flowId.value)
      return
    }

    const version = await this.versions.findById(FlowVersionId.of(flow.publishedVersionId))
    if (!version) {
      await this.scheduler.unschedulePolling(flowId.value)
      return
    }
    const parsed = version.parseTrigger()
    if (!parsed.ok) {
      await this.scheduler.unschedulePolling(flowId.value)
      return
    }

    const plan = classifyTrigger(parsed.value)
    switch (plan.kind) {
      case 'cron':
        await this.scheduler.unschedulePolling(flowId.value)
        break
      case 'event': {
        if (plan.pieceName && plan.triggerName) {
          // Best-effort teardown: a failing onDisable must not block disabling.
          try {
            await this.triggers.disable({
              pieceName: plan.pieceName,
              triggerName: plan.triggerName,
              flowId: flowId.value,
              input: parsed.value.settings.input ?? {},
            })
          } catch {
            // swallow: still drop the poll job below
          }
        }
        await this.scheduler.unschedulePolling(flowId.value)
        break
      }
      case 'webhook':
      case 'polling':
      case 'empty':
        break
    }
  }
}
