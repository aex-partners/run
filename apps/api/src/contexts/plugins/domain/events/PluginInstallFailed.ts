import { DomainEvent } from '@/shared/kernel/DomainEvent'

// The piece package failed to install: status moved installing -> error. A retry
// (another install) is allowed from the error state.
export class PluginInstallFailed implements DomainEvent {
  readonly name = 'plugins.PluginInstallFailed'
  constructor(
    public readonly aggregateId: string,
    public readonly reason: string,
    public readonly occurredAt: Date,
  ) {}
}
