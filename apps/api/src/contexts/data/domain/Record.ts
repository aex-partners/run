import { AggregateRoot } from '@/shared/kernel/AggregateRoot'
import { Result, ok, fail } from '@/shared/kernel/Result'
import { JsonObject } from '@/shared/domain/Json'
import { RecordId } from '@/contexts/data/domain/RecordId'
import { EntityId } from '@/contexts/data/domain/EntityId'
import { Version } from '@/contexts/data/domain/Version'
import { RecordSchema } from '@/contexts/data/domain/RecordSchema'
import { RecordUpserted } from '@/contexts/data/domain/events/RecordUpserted'

// AGGREGATE of the INSTANCE domain (data entry). Generic on purpose: it holds no
// hardcoded field rules. It enforces exactly two invariants of its own —
// "data conforms to the schema" (delegated to RecordSchema) and optimistic
// concurrency (Version CAS). Persistence-as-JSON is an adapter detail it never
// sees.
export class Record extends AggregateRoot<RecordId> {
  private constructor(
    id: RecordId,
    public readonly entityId: EntityId,
    private _data: JsonObject,
    private _version: Version,
    private _createdBy: string | null,
  ) {
    super(id)
  }

  static create(
    id: RecordId,
    entityId: EntityId,
    schema: RecordSchema,
    raw: JsonObject,
    now: Date,
    opts?: { createdBy?: string },
  ): Result<Record> {
    const validated = schema.validate(raw)
    if (!validated.ok) return validated
    const record = new Record(id, entityId, validated.value, Version.initial(), opts?.createdBy ?? null)
    record.addEvent(new RecordUpserted(id.value, entityId.value, record._version.value, now))
    return ok(record)
  }

  update(schema: RecordSchema, raw: JsonObject, expected: Version, now: Date): Result<void> {
    if (!this._version.equals(expected)) {
      return fail(`record: version conflict (have ${this._version.value}, expected ${expected.value})`)
    }
    const validated = schema.validate(raw)
    if (!validated.ok) return validated
    this._data = validated.value
    this._version = this._version.next()
    this.addEvent(new RecordUpserted(this.id.value, this.entityId.value, this._version.value, now))
    return ok(undefined)
  }

  static rehydrate(
    id: RecordId,
    entityId: EntityId,
    data: JsonObject,
    version: Version,
    createdBy?: string | null,
  ): Record {
    return new Record(id, entityId, data, version, createdBy ?? null)
  }

  get data(): JsonObject {
    return this._data
  }

  get version(): Version {
    return this._version
  }

  get createdBy(): string | null {
    return this._createdBy
  }
}
