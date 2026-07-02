import { DomainEvent } from '@/shared/kernel/DomainEvent'

// The plugin was enabled: status moved disabled -> installed.
export class PluginEnabled implements DomainEvent {
  readonly name = 'plugins.PluginEnabled'
  constructor(
    public readonly aggregateId: string,
    public readonly occurredAt: Date,
  ) {}
}
