import { AggregateRoot } from '@/shared/kernel/AggregateRoot'
import { FlowId } from '@/contexts/automation/domain/ids'

// The AEX `flows` row as an aggregate. A Flow is the durable handle that owns a
// chain of versions; its mutable state is small (status, folder, the currently
// published version). The actual graph lives in FlowVersion. This is the richer
// counterpart to the skeleton's toy `Flow` and is the one the real engine uses.
export type FlowStatus = 'enabled' | 'disabled'

export class Flow extends AggregateRoot<FlowId> {
  private constructor(
    id: FlowId,
    private _status: FlowStatus,
    private _folderId: string | null,
    private _publishedVersionId: string | null,
    public readonly createdBy: string | null,
    public readonly createdAt: Date,
    private _updatedAt: Date,
  ) {
    super(id)
  }

  static create(props: { id: FlowId; createdBy: string | null; now: Date }): Flow {
    return new Flow(props.id, 'disabled', null, null, props.createdBy, props.now, props.now)
  }

  static rehydrate(props: {
    id: FlowId
    status: FlowStatus
    folderId: string | null
    publishedVersionId: string | null
    createdBy: string | null
    createdAt: Date
    updatedAt: Date
  }): Flow {
    return new Flow(
      props.id,
      props.status,
      props.folderId,
      props.publishedVersionId,
      props.createdBy,
      props.createdAt,
      props.updatedAt,
    )
  }

  enable(now: Date): void {
    this._status = 'enabled'
    this._updatedAt = now
  }

  disable(now: Date): void {
    this._status = 'disabled'
    this._updatedAt = now
  }

  // Mark a version as the published (live) one. Lifecycle registration of its
  // trigger is an application concern, not the aggregate's.
  publish(versionId: string, now: Date): void {
    this._publishedVersionId = versionId
    this._updatedAt = now
  }

  moveToFolder(folderId: string | null, now: Date): void {
    this._folderId = folderId
    this._updatedAt = now
  }

  isEnabled(): boolean {
    return this._status === 'enabled'
  }

  get status(): FlowStatus {
    return this._status
  }
  get folderId(): string | null {
    return this._folderId
  }
  get publishedVersionId(): string | null {
    return this._publishedVersionId
  }
  get updatedAt(): Date {
    return this._updatedAt
  }
}
