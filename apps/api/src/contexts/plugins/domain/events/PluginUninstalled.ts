import { DomainEvent } from '@/shared/kernel/DomainEvent'

// The plugin was uninstalled: status reset to available, config cleared, install
// metadata dropped.
export class PluginUninstalled implements DomainEvent {
  readonly name = 'plugins.PluginUninstalled'
  constructor(
    public readonly aggregateId: string,
    public readonly occurredAt: Date,
  ) {}
}
