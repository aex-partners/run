import { AggregateRoot } from '@/shared/kernel/AggregateRoot'
import { Result, ok, fail } from '@/shared/kernel/Result'
import { UserId } from '@/contexts/identity/domain/UserId'
import { Email } from '@/contexts/identity/domain/Email'
import { UserRole } from '@/contexts/identity/domain/UserRole'
import { UserKind } from '@/contexts/identity/domain/UserKind'
import { UserInvited } from '@/contexts/identity/domain/events/UserInvited'
import { UserRoleChanged } from '@/contexts/identity/domain/events/UserRoleChanged'
import { UserStatusChanged } from '@/contexts/identity/domain/events/UserStatusChanged'
import { UserRenamed } from '@/contexts/identity/domain/events/UserRenamed'
import { UserDeleted } from '@/contexts/identity/domain/events/UserDeleted'

export type UserStatus = 'active' | 'inactive'

// Snapshot used by the mapper to rehydrate a user from a persisted row. No
// validation runs on this path (the row is trusted) and no events are recorded.
export interface UserSnapshot {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image: string | null
  role: string
  kind: UserKind
  banned: boolean
  banReason: string | null
  banExpires: Date | null
  twoFactorEnabled: boolean
  createdAt: Date
  updatedAt: Date
}

const MAX_NAME_LENGTH = 100

// AGGREGATE ROOT of the identity context. Guards the invariants of an account:
// a valid name, a normalized email, and the role-transition rules (only an owner
// may promote to owner or change another owner). Ban state lives here too. The
// password/credential lives in a separate better-auth `accounts` row and is
// never held by this aggregate.
export class User extends AggregateRoot<UserId> {
  private constructor(
    id: UserId,
    private _name: string,
    private _email: Email,
    private _emailVerified: boolean,
    private _image: string | null,
    private _role: UserRole,
    private readonly _kind: UserKind,
    private _banned: boolean,
    private _banReason: string | null,
    private _banExpires: Date | null,
    private _twoFactorEnabled: boolean,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {
    super(id)
  }

  // Invite a brand-new human account. The invitee is created already
  // email-verified with the default "user" role and no password (they set it via
  // the reset-password link). Mirrors users.invite.
  static invite(id: UserId, name: string, email: Email, now: Date): Result<User> {
    const cleanName = name.trim()
    if (cleanName.length < 1) return fail('User: name is required')
    if (cleanName.length > MAX_NAME_LENGTH) return fail(`User: name must be at most ${MAX_NAME_LENGTH} characters`)
    const role = UserRole.fromTrusted('user')
    const user = new User(
      id,
      cleanName,
      email,
      true,
      null,
      role,
      'human',
      false,
      null,
      null,
      false,
      now,
      now,
    )
    user.addEvent(new UserInvited(id.value, email.value, cleanName, now))
    return ok(user)
  }

  static rehydrate(s: UserSnapshot): User {
    return new User(
      UserId.of(s.id),
      s.name,
      Email.fromTrusted(s.email),
      s.emailVerified,
      s.image,
      UserRole.fromTrusted(s.role),
      s.kind,
      s.banned,
      s.banReason,
      s.banExpires,
      s.twoFactorEnabled,
      s.createdAt,
      s.updatedAt,
    )
  }

  rename(name: string, now: Date): Result<void> {
    const cleanName = name.trim()
    if (cleanName.length < 1) return fail('User: name is required')
    if (cleanName.length > MAX_NAME_LENGTH) return fail(`User: name must be at most ${MAX_NAME_LENGTH} characters`)
    this._name = cleanName
    this._updatedAt = now
    this.addEvent(new UserRenamed(this.id.value, cleanName, now))
    return ok(undefined)
  }

  // Role transition with the source's owner-specific guards. The actor's role is
  // an authorization input the aggregate enforces; the "cannot change your own
  // role" check (which needs the actor's id) lives in the service.
  changeRole(newRole: UserRole, actorRole: UserRole, now: Date): Result<void> {
    if (this._role.isOwner() && !actorRole.isOwner()) {
      return fail("Only owners can change another owner's role")
    }
    if (newRole.isOwner() && !actorRole.isOwner()) {
      return fail('Only owners can promote to owner')
    }
    const from = this._role.value
    this._role = newRole
    this._updatedAt = now
    this.addEvent(new UserRoleChanged(this.id.value, from, newRole.value, now))
    return ok(undefined)
  }

  // Active/inactive toggle == ban/unban. Mirrors users.updateStatus.
  setStatus(status: UserStatus, now: Date): Result<void> {
    this._banned = status === 'inactive'
    if (status === 'active') {
      this._banReason = null
      this._banExpires = null
    }
    this._updatedAt = now
    this.addEvent(new UserStatusChanged(this.id.value, status, now))
    return ok(undefined)
  }

  markDeleted(now: Date): void {
    this.addEvent(new UserDeleted(this.id.value, now))
  }

  get name(): string {
    return this._name
  }
  get email(): Email {
    return this._email
  }
  get emailVerified(): boolean {
    return this._emailVerified
  }
  get image(): string | null {
    return this._image
  }
  get role(): UserRole {
    return this._role
  }
  get kind(): UserKind {
    return this._kind
  }
  get banned(): boolean {
    return this._banned
  }
  get banReason(): string | null {
    return this._banReason
  }
  get banExpires(): Date | null {
    return this._banExpires
  }
  get twoFactorEnabled(): boolean {
    return this._twoFactorEnabled
  }
  get createdAt(): Date {
    return this._createdAt
  }
  get updatedAt(): Date {
    return this._updatedAt
  }

  get status(): UserStatus {
    return this._banned ? 'inactive' : 'active'
  }
}
