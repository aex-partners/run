import { DomainEvent } from '@/shared/kernel/DomainEvent'

// The plugin's configuration bag was replaced.
export class PluginConfigured implements DomainEvent {
  readonly name = 'plugins.PluginConfigured'
  constructor(
    public readonly aggregateId: string,
    public readonly occurredAt: Date,
  ) {}
}
