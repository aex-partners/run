import { AggregateRoot } from '@/shared/kernel/AggregateRoot'
import { Result, ok, fail } from '@/shared/kernel/Result'
import { FlowId, FlowVersionId } from '@/contexts/automation/domain/ids'
import { FlowTrigger } from '@/contexts/automation/domain/FlowDsl'

// A versioned snapshot of a flow's graph. `draft` versions are editable; `locked`
// versions are immutable and publishable. The graph is stored as the trigger JSON
// string (AP-style linked list), kept raw so persistence round-trips byte-for-byte
// and parsing is an explicit, fallible step.
export type FlowVersionState = 'draft' | 'locked'

export class FlowVersion extends AggregateRoot<FlowVersionId> {
  private constructor(
    id: FlowVersionId,
    public readonly flowId: FlowId,
    private _displayName: string,
    private _triggerRaw: string,
    private _state: FlowVersionState,
    private _valid: boolean,
    public readonly schemaVersion: string | null,
    public readonly createdAt: Date,
    private _updatedAt: Date,
  ) {
    super(id)
  }

  static createDraft(props: {
    id: FlowVersionId
    flowId: FlowId
    displayName: string
    triggerRaw: string
    valid: boolean
    schemaVersion?: string | null
    now: Date
  }): FlowVersion {
    return new FlowVersion(
      props.id,
      props.flowId,
      props.displayName,
      props.triggerRaw,
      'draft',
      props.valid,
      props.schemaVersion ?? null,
      props.now,
      props.now,
    )
  }

  static rehydrate(props: {
    id: FlowVersionId
    flowId: FlowId
    displayName: string
    triggerRaw: string
    state: FlowVersionState
    valid: boolean
    schemaVersion: string | null
    createdAt: Date
    updatedAt: Date
  }): FlowVersion {
    return new FlowVersion(
      props.id,
      props.flowId,
      props.displayName,
      props.triggerRaw,
      props.state,
      props.valid,
      props.schemaVersion,
      props.createdAt,
      props.updatedAt,
    )
  }

  // Overwrite an in-place draft (saveVersion). Locked versions are immutable.
  updateDraft(props: { displayName: string; triggerRaw: string; valid: boolean; now: Date }): Result<void> {
    if (this._state !== 'draft') return fail('FlowVersion: cannot edit a locked version')
    this._displayName = props.displayName
    this._triggerRaw = props.triggerRaw
    this._valid = props.valid
    this._updatedAt = props.now
    return ok(undefined)
  }

  // Promote a draft to locked + valid (publish).
  lock(now: Date): void {
    this._state = 'locked'
    this._valid = true
    this._updatedAt = now
  }

  // Parse the stored graph. Callers own the failure (BAD_REQUEST in the source).
  parseTrigger(): Result<FlowTrigger> {
    try {
      return ok(JSON.parse(this._triggerRaw) as FlowTrigger)
    } catch {
      return fail('FlowVersion: trigger is not valid JSON')
    }
  }

  isDraft(): boolean {
    return this._state === 'draft'
  }
  isLocked(): boolean {
    return this._state === 'locked'
  }

  get displayName(): string {
    return this._displayName
  }
  get triggerRaw(): string {
    return this._triggerRaw
  }
  get state(): FlowVersionState {
    return this._state
  }
  get valid(): boolean {
    return this._valid
  }
  get updatedAt(): Date {
    return this._updatedAt
  }
}
