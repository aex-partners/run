import { User, UserSnapshot } from '@/contexts/identity/domain/User'
import { UserKind, isUserKind } from '@/contexts/identity/domain/UserKind'

// Persistence row shape of the `users` table. The mapper is the only place that
// knows the on-disk column shapes (nullable columns, the kind enum default).
export interface UserRow {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image: string | null
  role: string
  kind: UserKind
  banned: boolean | null
  banReason: string | null
  banExpires: Date | null
  twoFactorEnabled: boolean | null
  createdAt: Date
  updatedAt: Date
}

export const UserMapper = {
  toDomain(row: UserRow): User {
    const snapshot: UserSnapshot = {
      id: row.id,
      name: row.name,
      email: row.email,
      emailVerified: row.emailVerified,
      image: row.image,
      role: row.role,
      kind: isUserKind(row.kind) ? row.kind : 'human',
      banned: row.banned ?? false,
      banReason: row.banReason,
      banExpires: row.banExpires,
      twoFactorEnabled: row.twoFactorEnabled ?? false,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }
    return User.rehydrate(snapshot)
  },

  toPersistence(user: User): UserRow {
    return {
      id: user.id.value,
      name: user.name,
      email: user.email.value,
      emailVerified: user.emailVerified,
      image: user.image,
      role: user.role.value,
      kind: user.kind,
      banned: user.banned,
      banReason: user.banReason,
      banExpires: user.banExpires,
      twoFactorEnabled: user.twoFactorEnabled,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }
  },
}
