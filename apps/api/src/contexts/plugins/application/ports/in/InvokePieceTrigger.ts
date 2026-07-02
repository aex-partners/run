import { Json } from '@/shared/domain/Json'
import { Result } from '@/shared/kernel/Result'

// Driving port of the plugins context for piece TRIGGERS. automation reaches this
// only via its TriggerRegistry ACL, wired in main — never by importing this file
// directly. Sibling to InvokePiece; ports the source `invoke-piece-trigger.ts`.

// The lifecycle hook to dispatch. `run` polls and returns fresh items; `onEnable`
// / `onDisable` manage the trigger's subscription (and any declared poll schedule).
export type PieceTriggerAction = 'onEnable' | 'onDisable' | 'run'

// Flow-scoped invocation context. Carries credential selection and webhook
// delivery details that the piece trigger context needs.
export interface InvokePieceTriggerContext {
  // The flow this trigger belongs to; scopes the trigger's store.
  flowId: string
  // Optional specific credential; otherwise the plugin's primary/active one.
  credentialId?: string
  // Inbound payload for webhook-style hooks (unused by polling).
  payload?: Json
  // Webhook delivery URL for webhook-style hooks.
  webhookUrl?: string
}

export interface InvokePieceTriggerCommand {
  pieceName: string
  triggerName: string
  action: PieceTriggerAction
  // Trigger props (the `settings.input` of the flow trigger).
  input: Json
  context: InvokePieceTriggerContext
}

// `run` resolves to the emitted item list (Json array, one flow run per item
// downstream). `onEnable` / `onDisable` resolve to a subscription descriptor
// ({ strategy?, scheduledCron?, scheduledTimezone? }) so the lifecycle layer can
// register or tear down a poll schedule.
export interface InvokePieceTrigger {
  execute(cmd: InvokePieceTriggerCommand): Promise<Result<Json>>
}
