import { DomainEvent } from '@/shared/kernel/DomainEvent'

// The piece package finished installing: status moved installing -> installed.
export class PluginInstalled implements DomainEvent {
  readonly name = 'plugins.PluginInstalled'
  constructor(
    public readonly aggregateId: string,
    public readonly pieceName: string,
    public readonly occurredAt: Date,
  ) {}
}
