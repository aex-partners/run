import { DomainEvent } from '@/shared/kernel/DomainEvent'

// The plugin was disabled: status moved installed -> disabled.
export class PluginDisabled implements DomainEvent {
  readonly name = 'plugins.PluginDisabled'
  constructor(
    public readonly aggregateId: string,
    public readonly occurredAt: Date,
  ) {}
}
