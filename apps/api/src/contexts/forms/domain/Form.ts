import { AggregateRoot } from '@/shared/kernel/AggregateRoot'
import { Result, ok, fail } from '@/shared/kernel/Result'
import { FormId } from '@/contexts/forms/domain/FormId'
import { EntityRef } from '@/contexts/forms/domain/EntityRef'
import { FormField } from '@/contexts/forms/domain/FormField'
import { FormSettings } from '@/contexts/forms/domain/FormSettings'
import { EntityFieldSpec } from '@/contexts/forms/domain/EntityFieldSpec'
import { FormCreated } from '@/contexts/forms/domain/events/FormCreated'
import { FormUpdated } from '@/contexts/forms/domain/events/FormUpdated'
import { FormDeleted } from '@/contexts/forms/domain/events/FormDeleted'
import { FormPublished } from '@/contexts/forms/domain/events/FormPublished'

export interface FormChanges {
  name?: string
  description?: string
  fields?: FormField[]
  settings?: FormSettings
}

// AGGREGATE. A public-or-private intake surface bound to one entity. It guards
// its own invariants (a name is required; public visibility mints a token once)
// and decides which fields/required overrides apply to a submission. It never
// knows the entity's real field types — those arrive as EntityFieldSpec through
// an ACL.
export class Form extends AggregateRoot<FormId> {
  private constructor(
    id: FormId,
    public readonly entityId: EntityRef,
    private _name: string,
    private _description: string | null,
    private _fields: FormField[],
    private _settings: FormSettings,
    private _publicToken: string | null,
    private _isPublic: boolean,
    public readonly createdBy: string,
  ) {
    super(id)
  }

  static create(
    id: FormId,
    entityId: EntityRef,
    name: string,
    fields: FormField[],
    settings: FormSettings,
    createdBy: string,
    now: Date,
  ): Result<Form> {
    const trimmed = name.trim()
    if (trimmed.length < 1) return fail('Form: name is required')
    const form = new Form(id, entityId, trimmed, null, fields, settings, null, false, createdBy)
    form.addEvent(new FormCreated(id.value, entityId.value, trimmed, now))
    return ok(form)
  }

  // Rehydrate from persistence (no events, no re-validation).
  static rehydrate(
    id: FormId,
    entityId: EntityRef,
    name: string,
    description: string | null,
    fields: FormField[],
    settings: FormSettings,
    publicToken: string | null,
    isPublic: boolean,
    createdBy: string,
  ): Form {
    return new Form(id, entityId, name, description, fields, settings, publicToken, isPublic, createdBy)
  }

  get name(): string {
    return this._name
  }

  get description(): string | null {
    return this._description
  }

  fields(): readonly FormField[] {
    return this._fields
  }

  settings(): FormSettings {
    return this._settings
  }

  get publicToken(): string | null {
    return this._publicToken
  }

  get isPublic(): boolean {
    return this._isPublic
  }

  // Partial update: only provided fields change. A blank name is rejected.
  update(changes: FormChanges, now: Date): Result<void> {
    if (changes.name !== undefined) {
      const trimmed = changes.name.trim()
      if (trimmed.length < 1) return fail('Form: name is required')
      this._name = trimmed
    }
    if (changes.description !== undefined) this._description = changes.description
    if (changes.fields !== undefined) this._fields = changes.fields
    if (changes.settings !== undefined) this._settings = changes.settings
    this.addEvent(new FormUpdated(this.id.value, this.entityId.value, now))
    return ok(undefined)
  }

  // Toggles public visibility. The token is minted once, the first time the form
  // goes public, and then preserved across toggles (mirrors AEX togglePublic).
  // `generatedToken` is supplied by the adapter so the domain stays deterministic.
  togglePublic(generatedToken: string, now: Date): Result<void> {
    this._isPublic = !this._isPublic
    if (this._isPublic && !this._publicToken) {
      this._publicToken = generatedToken
    }
    this.addEvent(new FormPublished(this.id.value, this._isPublic, this._publicToken, now))
    return ok(undefined)
  }

  markDeleted(now: Date): void {
    this.addEvent(new FormDeleted(this.id.value, this.entityId.value, now))
  }

  // Build the validation field set for a submission: visible form fields mapped
  // onto their entity field, with the form's per-field `required` override
  // applied. Fails if a form field references a field the entity no longer has.
  buildSubmissionFields(entityFields: EntityFieldSpec[]): Result<EntityFieldSpec[]> {
    const out: EntityFieldSpec[] = []
    for (const ff of this._fields) {
      if (!ff.visible) continue
      const ef = entityFields.find((e) => e.id === ff.entityFieldId)
      if (!ef) return fail(`Form: field ${ff.entityFieldId} not found in entity`)
      out.push({ ...ef, required: ff.required })
    }
    return ok(out)
  }
}
