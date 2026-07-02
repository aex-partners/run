import { describe, it, expect } from 'vitest'
import { UserMapper, UserRow } from '@/contexts/identity/application/mappers/UserMapper'

const T0 = new Date('2026-06-29T12:00:00.000Z')
const T1 = new Date('2026-06-29T13:00:00.000Z')

const baseRow = (over: Partial<UserRow> = {}): UserRow => ({
  id: 'u-1',
  name: 'Jane Doe',
  email: 'jane@example.com',
  emailVerified: true,
  image: 'https://cdn/x.png',
  role: 'admin',
  kind: 'human',
  banned: false,
  banReason: null,
  banExpires: null,
  twoFactorEnabled: false,
  createdAt: T0,
  updatedAt: T1,
  ...over,
})

describe('UserMapper.toDomain', () => {
  it('maps a fully-populated row into the aggregate', () => {
    const banExpires = new Date('2026-07-01T00:00:00.000Z')
    const user = UserMapper.toDomain(
      baseRow({ banned: true, banReason: 'spam', banExpires, twoFactorEnabled: true, kind: 'bot' }),
    )
    expect(user.id.value).toBe('u-1')
    expect(user.name).toBe('Jane Doe')
    expect(user.email.value).toBe('jane@example.com')
    expect(user.role.value).toBe('admin')
    expect(user.kind).toBe('bot')
    expect(user.image).toBe('https://cdn/x.png')
    expect(user.banned).toBe(true)
    expect(user.banReason).toBe('spam')
    expect(user.banExpires).toEqual(banExpires)
    expect(user.twoFactorEnabled).toBe(true)
    expect(user.createdAt).toEqual(T0)
    expect(user.updatedAt).toEqual(T1)
  })

  it('coerces null nullable columns to safe defaults', () => {
    const user = UserMapper.toDomain(
      baseRow({ image: null, banned: null, banReason: null, banExpires: null, twoFactorEnabled: null }),
    )
    expect(user.image).toBeNull()
    expect(user.banned).toBe(false) // null -> false
    expect(user.twoFactorEnabled).toBe(false) // null -> false
    expect(user.banReason).toBeNull()
    expect(user.banExpires).toBeNull()
  })

  it('falls back to the "human" kind when the column holds an unknown value', () => {
    // The on-disk enum could carry a legacy/garbage value; the mapper guards it.
    const user = UserMapper.toDomain(baseRow({ kind: 'alien' as UserRow['kind'] }))
    expect(user.kind).toBe('human')
  })

  it('keeps a valid "bot" kind', () => {
    expect(UserMapper.toDomain(baseRow({ kind: 'bot' })).kind).toBe('bot')
  })
})

describe('UserMapper.toPersistence', () => {
  it('writes the aggregate back to the row shape', () => {
    const row = baseRow()
    const out = UserMapper.toPersistence(UserMapper.toDomain(row))
    expect(out).toEqual(row)
  })
})

describe('UserMapper round-trip', () => {
  it('toPersistence(toDomain(row)) is identity for a clean row', () => {
    const row = baseRow({ banned: true, banReason: 'tos', twoFactorEnabled: true })
    expect(UserMapper.toPersistence(UserMapper.toDomain(row))).toEqual(row)
  })

  it('normalizes nullable booleans on the way back (null -> false)', () => {
    const row = baseRow({ banned: null, twoFactorEnabled: null })
    const out = UserMapper.toPersistence(UserMapper.toDomain(row))
    expect(out.banned).toBe(false)
    expect(out.twoFactorEnabled).toBe(false)
  })
})
