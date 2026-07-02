import {
  TriggerRegistry,
  TriggerRef,
  EnableResult,
  PollResult,
} from '@/contexts/automation/application/ports/out/TriggerRegistry'

// Placeholder/test double for the trigger registry. The REAL implementation is an
// ACL bridge wired in main to the plugins/pieces `invoke-piece-trigger` primitive
// (onEnable/onDisable/run hooks + the dedupe seen-set). Here every hook is a no-op
// so the engine wiring runs without the plugins context present.
export class StubTriggerRegistry implements TriggerRegistry {
  async enable(_ref: TriggerRef): Promise<EnableResult> {
    return {}
  }

  async disable(_ref: TriggerRef): Promise<void> {
    // no-op
  }

  async poll(_ref: TriggerRef): Promise<PollResult> {
    return { items: [] }
  }
}
