import { describe, it, expect } from 'vitest'
import { User } from '@/contexts/identity/domain/User'
import { UserId } from '@/contexts/identity/domain/UserId'
import { Email } from '@/contexts/identity/domain/Email'
import { UserRole } from '@/contexts/identity/domain/UserRole'
import { isUserKind } from '@/contexts/identity/domain/UserKind'
import { DomainEvent } from '@/shared/kernel/DomainEvent'

// Reads the single recorded event, narrowing away the `undefined` that
// noUncheckedIndexedAccess attaches to events[0].
const ev = (events: DomainEvent[]): DomainEvent => {
  const e = events[0]
  if (!e) throw new Error('expected a recorded event')
  return e
}

const NOW = new Date('2026-06-29T10:00:00.000Z')
const LATER = new Date('2026-06-29T11:00:00.000Z')
const id = UserId.of('u-1')
const email = Email.fromTrusted('jane@example.com')

const invited = (): User => {
  const r = User.invite(id, 'Jane Doe', email, NOW)
  if (!r.ok) throw new Error(r.error)
  r.value.pullEvents() // drop the UserInvited event so per-test assertions are clean
  return r.value
}

describe('User.invite', () => {
  it('creates a verified human user with the default role and no ban', () => {
    const r = User.invite(id, '  Jane Doe  ', email, NOW)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const u = r.value
    expect(u.name).toBe('Jane Doe') // trimmed
    expect(u.email.equals(email)).toBe(true)
    expect(u.emailVerified).toBe(true)
    expect(u.role.value).toBe('user')
    expect(u.kind).toBe('human')
    expect(u.banned).toBe(false)
    expect(u.status).toBe('active')
    expect(u.createdAt).toEqual(NOW)
    expect(u.updatedAt).toEqual(NOW)
  })

  it('records a UserInvited event', () => {
    const r = User.invite(id, 'Jane', email, NOW)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const events = r.value.pullEvents()
    expect(events).toHaveLength(1)
    expect(ev(events).name).toBe('identity.UserInvited')
    expect(ev(events).aggregateId).toBe('u-1')
    expect(ev(events).occurredAt).toEqual(NOW)
  })

  it('rejects an empty / whitespace-only name', () => {
    expect(User.invite(id, '   ', email, NOW).ok).toBe(false)
    expect(User.invite(id, '', email, NOW).ok).toBe(false)
  })

  it('rejects a name longer than 100 characters', () => {
    const r = User.invite(id, 'x'.repeat(101), email, NOW)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toContain('at most 100')
  })

  it('accepts a name of exactly 100 characters', () => {
    expect(User.invite(id, 'x'.repeat(100), email, NOW).ok).toBe(true)
  })
})

describe('User.rename', () => {
  it('updates the name, bumps updatedAt and records UserRenamed', () => {
    const u = invited()
    const r = u.rename('  New Name  ', LATER)
    expect(r.ok).toBe(true)
    expect(u.name).toBe('New Name')
    expect(u.updatedAt).toEqual(LATER)
    const events = u.pullEvents()
    expect(events).toHaveLength(1)
    expect(ev(events).name).toBe('identity.UserRenamed')
  })

  it('rejects an empty name and leaves state unchanged', () => {
    const u = invited()
    const r = u.rename('   ', LATER)
    expect(r.ok).toBe(false)
    expect(u.name).toBe('Jane Doe')
    expect(u.pullEvents()).toHaveLength(0)
  })

  it('rejects a name over 100 characters', () => {
    const u = invited()
    expect(u.rename('y'.repeat(101), LATER).ok).toBe(false)
  })
})

describe('User.changeRole owner-transition rules', () => {
  const owner = UserRole.fromTrusted('owner')
  const admin = UserRole.fromTrusted('admin')
  const user = UserRole.fromTrusted('user')

  it('lets an admin promote a regular user to admin', () => {
    const u = invited() // role: user
    const r = u.changeRole(admin, admin, LATER)
    expect(r.ok).toBe(true)
    expect(u.role.value).toBe('admin')
    const events = u.pullEvents()
    expect(events).toHaveLength(1)
    expect(ev(events).name).toBe('identity.UserRoleChanged')
    // Event carries the from/to transition.
    expect((ev(events) as unknown as { from: string }).from).toBe('user')
    expect((ev(events) as unknown as { to: string }).to).toBe('admin')
    expect(u.updatedAt).toEqual(LATER)
  })

  it('forbids a non-owner from promoting anyone to owner', () => {
    const u = invited() // role: user
    const r = u.changeRole(owner, admin, LATER)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('Only owners can promote to owner')
    expect(u.role.value).toBe('user') // unchanged
    expect(u.pullEvents()).toHaveLength(0)
  })

  it('lets an owner promote a user to owner', () => {
    const u = invited()
    const r = u.changeRole(owner, owner, LATER)
    expect(r.ok).toBe(true)
    expect(u.role.value).toBe('owner')
  })

  it("forbids a non-owner from changing an existing owner's role", () => {
    const u = User.rehydrate({
      id: 'u-2',
      name: 'Owner',
      email: 'owner@example.com',
      emailVerified: true,
      image: null,
      role: 'owner',
      kind: 'human',
      banned: false,
      banReason: null,
      banExpires: null,
      twoFactorEnabled: false,
      createdAt: NOW,
      updatedAt: NOW,
    })
    const r = u.changeRole(user, admin, LATER)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe("Only owners can change another owner's role")
    expect(u.role.value).toBe('owner')
  })

  it('lets an owner demote another owner', () => {
    const u = User.rehydrate({
      id: 'u-2',
      name: 'Owner',
      email: 'owner@example.com',
      emailVerified: true,
      image: null,
      role: 'owner',
      kind: 'human',
      banned: false,
      banReason: null,
      banExpires: null,
      twoFactorEnabled: false,
      createdAt: NOW,
      updatedAt: NOW,
    })
    const r = u.changeRole(user, owner, LATER)
    expect(r.ok).toBe(true)
    expect(u.role.value).toBe('user')
  })
})

describe('User.setStatus (ban/unban)', () => {
  it('marks the user inactive (banned) and records UserStatusChanged', () => {
    const u = invited()
    const r = u.setStatus('inactive', LATER)
    expect(r.ok).toBe(true)
    expect(u.banned).toBe(true)
    expect(u.status).toBe('inactive')
    const events = u.pullEvents()
    expect(events).toHaveLength(1)
    expect(ev(events).name).toBe('identity.UserStatusChanged')
    expect((ev(events) as unknown as { status: string }).status).toBe('inactive')
  })

  it('reactivating clears ban reason and expiry', () => {
    const u = User.rehydrate({
      id: 'u-3',
      name: 'Banned',
      email: 'banned@example.com',
      emailVerified: true,
      image: null,
      role: 'user',
      kind: 'human',
      banned: true,
      banReason: 'spam',
      banExpires: LATER,
      twoFactorEnabled: false,
      createdAt: NOW,
      updatedAt: NOW,
    })
    const r = u.setStatus('active', LATER)
    expect(r.ok).toBe(true)
    expect(u.banned).toBe(false)
    expect(u.banReason).toBeNull()
    expect(u.banExpires).toBeNull()
    expect(u.status).toBe('active')
  })
})

describe('User.markDeleted', () => {
  it('records a UserDeleted event without mutating other state', () => {
    const u = invited()
    u.markDeleted(LATER)
    const events = u.pullEvents()
    expect(events).toHaveLength(1)
    expect(ev(events).name).toBe('identity.UserDeleted')
    expect(ev(events).aggregateId).toBe('u-1')
  })
})

describe('User.rehydrate', () => {
  it('restores a bot user and records no events', () => {
    const u = User.rehydrate({
      id: 'bot-1',
      name: 'Eric',
      email: 'Eric@Example.com',
      emailVerified: false,
      image: 'img.png',
      role: 'user',
      kind: 'bot',
      banned: false,
      banReason: null,
      banExpires: null,
      twoFactorEnabled: true,
      createdAt: NOW,
      updatedAt: LATER,
    })
    expect(u.kind).toBe('bot')
    expect(u.email.value).toBe('eric@example.com') // normalized via fromTrusted
    expect(u.twoFactorEnabled).toBe(true)
    expect(u.pullEvents()).toHaveLength(0)
  })
})

describe('Email VO', () => {
  it('normalizes (trim + lowercase) on of()', () => {
    const r = Email.of('  Jane.Doe@Example.COM ')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.value).toBe('jane.doe@example.com')
  })

  it('rejects malformed addresses', () => {
    for (const bad of ['not-an-email', 'a@b', 'a @b.com', '@example.com', 'a@b@c.com', '']) {
      expect(Email.of(bad).ok).toBe(false)
    }
  })

  it('fromTrusted normalizes but never rejects', () => {
    expect(Email.fromTrusted('  WEIRD@HOST ').value).toBe('weird@host')
  })

  it('equals compares normalized values', () => {
    const a = Email.fromTrusted('x@y.com')
    const b = Email.fromTrusted('X@Y.COM')
    expect(a.equals(b)).toBe(true)
    expect(a.toString()).toBe('x@y.com')
  })
})

describe('UserRole VO', () => {
  it('of() trims and rejects empty', () => {
    expect(UserRole.of('   ').ok).toBe(false)
    const r = UserRole.of('  admin ')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.value).toBe('admin')
  })

  it('isOwner / isAdminOrOwner predicates', () => {
    expect(UserRole.fromTrusted('owner').isOwner()).toBe(true)
    expect(UserRole.fromTrusted('admin').isOwner()).toBe(false)
    expect(UserRole.fromTrusted('owner').isAdminOrOwner()).toBe(true)
    expect(UserRole.fromTrusted('admin').isAdminOrOwner()).toBe(true)
    expect(UserRole.fromTrusted('user').isAdminOrOwner()).toBe(false)
  })

  it('equals compares the raw value', () => {
    expect(UserRole.fromTrusted('user').equals(UserRole.fromTrusted('user'))).toBe(true)
    expect(UserRole.fromTrusted('user').equals(UserRole.fromTrusted('admin'))).toBe(false)
  })
})

describe('UserKind guard', () => {
  it('accepts human and bot, rejects anything else', () => {
    expect(isUserKind('human')).toBe(true)
    expect(isUserKind('bot')).toBe(true)
    expect(isUserKind('robot')).toBe(false)
    expect(isUserKind('')).toBe(false)
  })
})
