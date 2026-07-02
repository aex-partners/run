import { AggregateRoot } from '@/shared/kernel/AggregateRoot'
import { Result, ok, fail } from '@/shared/kernel/Result'
import { JsonObject } from '@/shared/domain/Json'
import { CredentialId } from '@/contexts/credentials/domain/ids'
import { CredentialType } from '@/contexts/credentials/domain/CredentialType'
import { CredentialStatus } from '@/contexts/credentials/domain/CredentialStatus'
import { CredentialCreated } from '@/contexts/credentials/domain/events/CredentialCreated'
import { CredentialUpdated } from '@/contexts/credentials/domain/events/CredentialUpdated'
import { CredentialDeleted } from '@/contexts/credentials/domain/events/CredentialDeleted'
import { CredentialRefreshed } from '@/contexts/credentials/domain/events/CredentialRefreshed'

interface CredentialProps {
  name: string
  pluginName: string
  type: CredentialType
  status: CredentialStatus
  isPrimary: boolean
  value: JsonObject
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateCredentialProps {
  id: CredentialId
  name: string
  pluginName: string
  type: CredentialType
  value: JsonObject
  isPrimary?: boolean
  createdBy: string | null
  now: Date
}

export interface RehydrateCredentialProps {
  id: CredentialId
  name: string
  pluginName: string
  type: CredentialType
  status: CredentialStatus
  isPrimary: boolean
  value: JsonObject
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
}

export interface UpdateCredentialChanges {
  name?: string
  value?: JsonObject
  status?: CredentialStatus
  now: Date
}

// AGGREGATE. A stored secret for a plugin. The aggregate always holds the
// DECRYPTED value (a JSON bag); encryption-at-rest is a persistence concern that
// lives entirely in the repository adapter behind the Cipher port. Its lifecycle
// is a small state machine: created `active`, then update / refresh / mark-error
// / delete — every transition is PURE (mutates in-memory state + records an
// event); all IO lives in the use cases.
export class Credential extends AggregateRoot<CredentialId> {
  private constructor(
    id: CredentialId,
    private props: CredentialProps,
  ) {
    super(id)
  }

  // Factory + first transition. Guards the invariants of a valid new credential.
  // Covers both manual creation and the OAuth2 callback (type 'oauth2').
  static create(input: CreateCredentialProps): Result<Credential> {
    const name = input.name.trim()
    if (name.length < 1) return fail('Credential: name is required')
    if (input.pluginName.trim().length < 1) return fail('Credential: pluginName is required')

    const credential = new Credential(input.id, {
      name,
      pluginName: input.pluginName,
      type: input.type,
      status: 'active',
      isPrimary: input.isPrimary ?? false,
      value: input.value,
      createdBy: input.createdBy,
      createdAt: input.now,
      updatedAt: input.now,
    })
    credential.addEvent(new CredentialCreated(input.id.value, input.pluginName, input.type, input.now))
    return ok(credential)
  }

  // Rehydrate from persistence (no events, no re-validation of stored data).
  static rehydrate(input: RehydrateCredentialProps): Credential {
    return new Credential(input.id, {
      name: input.name,
      pluginName: input.pluginName,
      type: input.type,
      status: input.status,
      isPrimary: input.isPrimary,
      value: input.value,
      createdBy: input.createdBy,
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
    })
  }

  get name(): string {
    return this.props.name
  }

  get pluginName(): string {
    return this.props.pluginName
  }

  get type(): CredentialType {
    return this.props.type
  }

  get status(): CredentialStatus {
    return this.props.status
  }

  get isPrimary(): boolean {
    return this.props.isPrimary
  }

  get value(): JsonObject {
    return this.props.value
  }

  get createdBy(): string | null {
    return this.props.createdBy
  }

  get createdAt(): Date {
    return this.props.createdAt
  }

  get updatedAt(): Date {
    return this.props.updatedAt
  }

  // PURE. Apply a partial edit (name / value / status). Empty patches still bump
  // updatedAt and record the event, mirroring the source's unconditional update.
  update(changes: UpdateCredentialChanges): Result<void> {
    if (changes.name !== undefined) {
      const name = changes.name.trim()
      if (name.length < 1) return fail('Credential: name is required')
      this.props.name = name
    }
    if (changes.value !== undefined) this.props.value = changes.value
    if (changes.status !== undefined) this.props.status = changes.status
    this.props.updatedAt = changes.now
    this.addEvent(new CredentialUpdated(this.id.value, this.props.status, changes.now))
    return ok(undefined)
  }

  // PURE transition: store freshly-refreshed OAuth tokens and (re)activate.
  applyRefreshedTokens(value: JsonObject, now: Date): void {
    this.props.value = value
    this.props.status = 'active'
    this.props.updatedAt = now
    this.addEvent(new CredentialRefreshed(this.id.value, now))
  }

  // PURE transition: a refresh attempt failed; flag the credential so resolution
  // skips it until a human re-authorizes. Mirrors the source error fallback.
  markRefreshError(now: Date): void {
    this.props.status = 'error'
    this.props.updatedAt = now
    this.addEvent(new CredentialUpdated(this.id.value, 'error', now))
  }

  // PURE. Record the deletion fact; the repository performs the actual removal.
  markDeleted(now: Date): void {
    this.addEvent(new CredentialDeleted(this.id.value, now))
  }
}
