import { Json, JsonObject } from '@/shared/domain/Json'
import { Result } from '@/shared/kernel/Result'

// Driven port. The actual execution of a piece action against an integration
// (Bling, Gmail, generic HTTP) — loads the piece module and runs `action.run`
// with the framework ActionContext. Inherently impure -> isolated behind this
// port. The `auth`/`credentialId`/`userId` fields are OPTIONAL so the simple
// InvokePiece in-port (and its StubPieceClient) keep calling `call` unchanged,
// while ResolvePieceAction passes the resolved credential through.
export interface PieceCall {
  pieceId: string
  action: string
  input: Json
  // Decrypted credential value resolved by the application (null = no auth).
  auth?: JsonObject | null
  // The explicit credential id the caller chose, if any.
  credentialId?: string
  // Invoking user; reserved for auditing/scoping of side effects.
  userId?: string
}

// One lifecycle hook dispatch of a piece TRIGGER. Sibling to PieceCall: where
// `call` runs an action, `callTrigger` dispatches `onEnable` / `onDisable` / `run`
// against a flow-scoped context. Mirrors source `pieces/invoke-piece-trigger.ts`.
// `auth`/`credentialId` are OPTIONAL so the StubPieceClient keeps compiling.
export interface PieceTriggerCall {
  pieceId: string
  triggerName: string
  // Which lifecycle hook to dispatch.
  hook: 'onEnable' | 'onDisable' | 'run'
  // Trigger props (the `settings.input` of the flow trigger).
  input: Json
  // The flow this trigger belongs to; scopes the trigger's store.
  flowId: string
  // Decrypted credential value resolved by the application (null = no auth).
  auth?: JsonObject | null
  // The explicit credential id the caller chose, if any.
  credentialId?: string
  // Inbound payload for webhook-style hooks (unused by polling).
  payload?: Json
  // Webhook delivery URL for webhook-style hooks.
  webhookUrl?: string
}

export interface PieceTriggerResult {
  // Items emitted by `run` (deduped downstream). Empty for onEnable/onDisable.
  items: Json[]
  // Cron a POLLING trigger declared via setSchedule, if any.
  scheduledCron?: string
  // Timezone that accompanied `scheduledCron`, if the trigger supplied one.
  scheduledTimezone?: string
  // POLLING / WEBHOOK / APP_WEBHOOK / MANUAL — the trigger strategy, if declared.
  strategy?: string
}

export interface PieceClient {
  call(req: PieceCall): Promise<Result<Json>>
  // Dispatch a trigger lifecycle hook. Additive: existing `call` callers are
  // unaffected; the StubPieceClient implements both.
  callTrigger(req: PieceTriggerCall): Promise<Result<PieceTriggerResult>>
}
