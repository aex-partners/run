import { FlowTrigger, TriggerType } from '@/contexts/automation/domain/FlowDsl'

// Pure classification of a flow trigger into the lifecycle shape the scheduler /
// trigger registry needs. The DSL stores a `TriggerType`; this projects it into
// the operational kinds AEX schedules against:
//   cron     -> SCHEDULE trigger, fires on a cron pattern (BullMQ repeatable)
//   webhook  -> WEBHOOK trigger, passive, fired by an inbound HTTP delivery
//   event    -> PIECE trigger, strategy (POLLING vs WEBHOOK) resolved at enable
//               time by invoking the piece's onEnable hook
//   polling  -> a PIECE trigger known to poll (registry-refined)
//   empty    -> EMPTY trigger, nothing to schedule
export type TriggerKind = 'cron' | 'webhook' | 'event' | 'polling' | 'empty'

export interface TriggerPlan {
  kind: TriggerKind
  cron?: string
  pieceName?: string
  triggerName?: string
}

export function classifyTrigger(trigger: FlowTrigger): TriggerPlan {
  switch (trigger.type) {
    case TriggerType.SCHEDULE: {
      const cron = trigger.settings.input?.['cronExpression']
      return { kind: 'cron', cron: typeof cron === 'string' ? cron : undefined }
    }
    case TriggerType.WEBHOOK:
      return { kind: 'webhook' }
    case TriggerType.PIECE:
      return {
        kind: 'event',
        pieceName: trigger.settings.pieceName,
        triggerName: trigger.settings.triggerName,
      }
    case TriggerType.EMPTY:
    default:
      return { kind: 'empty' }
  }
}
