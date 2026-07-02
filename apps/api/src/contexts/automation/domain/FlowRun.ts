import { AggregateRoot } from '@/shared/kernel/AggregateRoot'
import { Json } from '@/shared/domain/Json'
import { FlowId, FlowRunId, FlowVersionId } from '@/contexts/automation/domain/ids'

// One execution of a flow version. Mirrors the AEX `flow_runs` row, including its
// lifecycle (pending -> running -> succeeded|failed, plus paused|stopped) and the
// `steps` JSON the engine produces. Raw JSON fields are kept as strings so the
// repository round-trips them and parsing stays explicit.
export type FlowRunStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'paused' | 'stopped'

export class FlowRun extends AggregateRoot<FlowRunId> {
  private constructor(
    id: FlowRunId,
    public readonly flowId: FlowId,
    public readonly flowVersionId: FlowVersionId | null,
    private _status: FlowRunStatus,
    public readonly triggeredBy: string | null,
    private _triggerPayloadRaw: string | null,
    private _stepsRaw: string,
    private _duration: number | null,
    private _tagsRaw: string,
    private _error: string | null,
    private _startedAt: Date | null,
    private _completedAt: Date | null,
    public readonly createdAt: Date,
  ) {
    super(id)
  }

  static createPending(props: {
    id: FlowRunId
    flowId: FlowId
    flowVersionId: FlowVersionId | null
    triggeredBy: string | null
    triggerPayloadRaw: string | null
    now: Date
  }): FlowRun {
    return new FlowRun(
      props.id,
      props.flowId,
      props.flowVersionId,
      'pending',
      props.triggeredBy,
      props.triggerPayloadRaw,
      '{}',
      null,
      '[]',
      null,
      null,
      null,
      props.now,
    )
  }

  static rehydrate(props: {
    id: FlowRunId
    flowId: FlowId
    flowVersionId: FlowVersionId | null
    status: FlowRunStatus
    triggeredBy: string | null
    triggerPayloadRaw: string | null
    stepsRaw: string
    duration: number | null
    tagsRaw: string
    error: string | null
    startedAt: Date | null
    completedAt: Date | null
    createdAt: Date
  }): FlowRun {
    return new FlowRun(
      props.id,
      props.flowId,
      props.flowVersionId,
      props.status,
      props.triggeredBy,
      props.triggerPayloadRaw,
      props.stepsRaw,
      props.duration,
      props.tagsRaw,
      props.error,
      props.startedAt,
      props.completedAt,
      props.createdAt,
    )
  }

  start(now: Date): void {
    this._status = 'running'
    this._startedAt = this._startedAt ?? now
  }

  succeed(stepsRaw: string, duration: number, now: Date): void {
    this._status = 'succeeded'
    this._stepsRaw = stepsRaw
    this._duration = duration
    this._completedAt = now
  }

  fail(error: string, opts: { stepsRaw?: string; duration?: number; now: Date }): void {
    this._status = 'failed'
    this._error = error
    if (opts.stepsRaw !== undefined) this._stepsRaw = opts.stepsRaw
    if (opts.duration !== undefined) this._duration = opts.duration
    this._completedAt = opts.now
  }

  pause(): void {
    this._status = 'paused'
  }

  stop(now: Date): void {
    this._status = 'stopped'
    this._completedAt = now
  }

  // Whether the worker should pick this run up (pending or a resumed running).
  isRunnable(): boolean {
    return this._status === 'pending' || this._status === 'running'
  }

  parseTriggerPayload(): Json | null {
    if (this._triggerPayloadRaw === null) return null
    try {
      return JSON.parse(this._triggerPayloadRaw) as Json
    } catch {
      return this._triggerPayloadRaw
    }
  }

  parseSteps(): Json {
    try {
      return JSON.parse(this._stepsRaw) as Json
    } catch {
      return {}
    }
  }

  get status(): FlowRunStatus {
    return this._status
  }
  get triggerPayloadRaw(): string | null {
    return this._triggerPayloadRaw
  }
  get stepsRaw(): string {
    return this._stepsRaw
  }
  get duration(): number | null {
    return this._duration
  }
  get tagsRaw(): string {
    return this._tagsRaw
  }
  get error(): string | null {
    return this._error
  }
  get startedAt(): Date | null {
    return this._startedAt
  }
  get completedAt(): Date | null {
    return this._completedAt
  }
}
