import { Json } from '@/shared/domain/Json'

// ACL out-port to the pieces/plugins world for trigger lifecycle. automation must
// not import the plugins context, so it declares WHAT it needs (run a piece
// trigger's lifecycle hook) and the composition root fulfills HOW (bridge to
// `invoke-piece-trigger.ts`). Ports the `invokePieceTrigger` contract.
export interface EnableResult {
  // Strategy the piece declared (POLLING / WEBHOOK / APP_WEBHOOK / MANUAL).
  strategy?: string
  // Cron a POLLING trigger declared via setSchedule, if any.
  scheduledCron?: string
}

export interface PollResult {
  // Items the trigger emitted this poll. Adapter is responsible for piece-level
  // dedupe (the AEX dedupe-key seen-set lives there, not in the pure core).
  items: Json[]
}

export interface TriggerRef {
  pieceName: string
  triggerName: string
  flowId: string
  input: Json
}

export interface TriggerRegistry {
  // onEnable hook; returns the strategy + optional cron for poll registration.
  enable(ref: TriggerRef): Promise<EnableResult>
  // onDisable hook; best-effort teardown.
  disable(ref: TriggerRef): Promise<void>
  // run hook; returns fresh (deduped) items, one flow run per item downstream.
  poll(ref: TriggerRef): Promise<PollResult>
}
