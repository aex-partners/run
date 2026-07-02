import { DomainEvent } from '@/shared/kernel/DomainEvent'

// The install was kicked off: status moved available/error -> installing and the
// (async) piece-package install is now in flight.
export class PluginInstalling implements DomainEvent {
  readonly name = 'plugins.PluginInstalling'
  constructor(
    public readonly aggregateId: string,
    public readonly pieceName: string,
    public readonly installedBy: string,
    public readonly occurredAt: Date,
  ) {}
}
