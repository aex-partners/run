import { AggregateRoot } from '@/shared/kernel/AggregateRoot'
import { Result, ok, fail } from '@/shared/kernel/Result'
import { EntityId } from '@/contexts/data/domain/EntityId'
import { FieldName } from '@/contexts/data/domain/FieldName'
import { Field, FieldMeta } from '@/contexts/data/domain/Field'
import {
  FieldType,
  FieldTypeConfig,
  FieldTypeFactory,
  FormulaFieldType,
} from '@/contexts/data/domain/FieldType'
import { Slug } from '@/contexts/data/domain/Slug'
import { RecordSchema } from '@/contexts/data/domain/RecordSchema'
import { EntityCreated } from '@/contexts/data/domain/events/EntityCreated'
import { FieldAdded } from '@/contexts/data/domain/events/FieldAdded'
import { EntityUpdated } from '@/contexts/data/domain/events/EntityUpdated'

export interface FieldDescriptor {
  name: string
  required: boolean
  type: FieldTypeConfig
  // AEX-shape metadata (optional; defaulted when absent).
  id?: string
  displayName?: string
  description?: string
  unique?: boolean
  defaultValue?: string
}

export interface EntityRehydrateOptions {
  slug?: string
  description?: string | null
  createdBy?: string | null
  createdAt?: Date
}

// Updates a single field's mutable attributes. Mirrors entities.updateField.
export interface FieldUpdate {
  name?: string
  required?: boolean
  type?: FieldTypeConfig
  unique?: boolean
  description?: string
  defaultValue?: string
}

// AGGREGATE of the META domain (schema design). Rich, classic DDD: it guards the
// invariants of what a VALID entity schema is. Its data is dynamic; its rules
// are static code.
export class EntityDefinition extends AggregateRoot<EntityId> {
  private constructor(
    id: EntityId,
    private _name: string,
    private _slug: string,
    private _description: string | null,
    private _createdBy: string | null,
    private _createdAt: Date,
    private _fields: Field[],
  ) {
    super(id)
  }

  static create(
    id: EntityId,
    name: string,
    now: Date,
    opts?: { createdBy?: string; description?: string },
  ): Result<EntityDefinition> {
    const trimmed = name.trim()
    if (trimmed.length < 1) return fail('EntityDefinition: name is required')
    const entity = new EntityDefinition(
      id,
      trimmed,
      Slug.from(trimmed).value,
      opts?.description ?? null,
      opts?.createdBy ?? null,
      now,
      [],
    )
    entity.addEvent(new EntityCreated(id.value, trimmed, now))
    return ok(entity)
  }

  // Rehydrate from persistence (no events, no re-validation of stored data).
  static rehydrate(
    id: EntityId,
    name: string,
    descriptors: FieldDescriptor[],
    opts?: EntityRehydrateOptions,
  ): Result<EntityDefinition> {
    const entity = new EntityDefinition(
      id,
      name,
      opts?.slug ?? Slug.from(name).value,
      opts?.description ?? null,
      opts?.createdBy ?? null,
      opts?.createdAt ?? new Date(0),
      [],
    )
    for (const d of descriptors) {
      const added = entity.addField(d, new Date(0), { silent: true })
      if (!added.ok) return fail(`EntityDefinition.rehydrate: ${added.error}`)
    }
    return ok(entity)
  }

  get name(): string {
    return this._name
  }

  get slug(): string {
    return this._slug
  }

  get description(): string | null {
    return this._description
  }

  get createdBy(): string | null {
    return this._createdBy
  }

  get createdAt(): Date {
    return this._createdAt
  }

  fields(): readonly Field[] {
    return this._fields
  }

  fieldById(fieldId: string): Field | undefined {
    return this._fields.find((f) => f.meta.id === fieldId)
  }

  toSchema(): RecordSchema {
    return new RecordSchema(this._fields)
  }

  // Invariants: unique name; a formula may only reference already-declared
  // fields (enforced by FieldTypeFactory). New fields go at the end so earlier
  // formulas never depend on later fields.
  addField(d: FieldDescriptor, now: Date, opts?: { silent?: boolean }): Result<void> {
    const name = FieldName.of(d.name)
    if (!name.ok) return name
    if (this._fields.some((f) => f.name.value === name.value.value)) {
      return fail(`EntityDefinition: field "${d.name}" already exists`)
    }
    const available = this._fields.map((f) => f.name.value)
    const type: Result<FieldType> = FieldTypeFactory.create(d.type, available)
    if (!type.ok) return type

    const meta: FieldMeta = {
      id: d.id,
      displayName: d.displayName,
      description: d.description,
      unique: d.unique,
      defaultValue: d.defaultValue,
    }
    this._fields.push(new Field(name.value, type.value, d.required, meta))
    if (!opts?.silent) {
      this.addEvent(new FieldAdded(this.id.value, name.value.value, type.value.kind, now))
    }
    return ok(undefined)
  }

  // Rename the entity and re-derive its slug. Description is optional.
  rename(name: string, now: Date): Result<void> {
    const trimmed = name.trim()
    if (trimmed.length < 1) return fail('EntityDefinition: name is required')
    this._name = trimmed
    this._slug = Slug.from(trimmed).value
    this.addEvent(new EntityUpdated(this.id.value, now))
    return ok(undefined)
  }

  describe(description: string, now: Date): Result<void> {
    this._description = description
    this.addEvent(new EntityUpdated(this.id.value, now))
    return ok(undefined)
  }

  // Update a single field by its stable id. Renames re-derive the FieldName (the
  // JSON key) — callers that migrate stored record keys do so separately.
  updateField(fieldId: string, update: FieldUpdate, now: Date): Result<void> {
    const idx = this._fields.findIndex((f) => f.meta.id === fieldId)
    if (idx === -1) return fail(`EntityDefinition: field "${fieldId}" not found`)
    const current = this._fields[idx]!

    const newName = update.name !== undefined ? Slug.from(update.name).value : current.name.value
    const fieldName = FieldName.of(newName)
    if (!fieldName.ok) return fieldName
    if (this._fields.some((f, i) => i !== idx && f.name.value === fieldName.value.value)) {
      return fail(`EntityDefinition: field "${newName}" already exists`)
    }

    const available = this._fields.filter((_, i) => i !== idx).map((f) => f.name.value)
    const config = update.type ?? current.type.toConfig()
    const type = FieldTypeFactory.create(config, available)
    if (!type.ok) return type

    const meta: FieldMeta = {
      ...current.meta,
      ...(update.name !== undefined ? { displayName: update.name } : {}),
      ...(update.description !== undefined ? { description: update.description } : {}),
      ...(update.unique !== undefined ? { unique: update.unique } : {}),
      ...(update.defaultValue !== undefined ? { defaultValue: update.defaultValue } : {}),
    }
    this._fields[idx] = new Field(
      fieldName.value,
      type.value,
      update.required ?? current.required,
      meta,
    )
    this.addEvent(new EntityUpdated(this.id.value, now))
    return ok(undefined)
  }

  // Cannot drop a field a formula depends on. Accepts either the field id (AEX)
  // or the raw field name/slug.
  removeField(idOrName: string): Result<void> {
    const target =
      this._fields.find((f) => f.meta.id === idOrName) ??
      this._fields.find((f) => f.name.value === idOrName)
    if (!target) return fail(`EntityDefinition: field "${idOrName}" not found`)

    const rawName = target.name.value
    const dependent = this._fields.find(
      (f) => f.type instanceof FormulaFieldType && f.type.formula.refs.includes(rawName),
    )
    if (dependent) {
      return fail(`EntityDefinition: "${rawName}" is used by formula "${dependent.name.value}"`)
    }
    this._fields = this._fields.filter((f) => f !== target)
    return ok(undefined)
  }
}
