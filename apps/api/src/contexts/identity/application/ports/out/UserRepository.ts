import { User } from '@/contexts/identity/domain/User'
import { UserId } from '@/contexts/identity/domain/UserId'
import { Email } from '@/contexts/identity/domain/Email'

// Driven port. The application states WHAT it needs from persistence; an adapter
// under adapters/out implements HOW (Drizzle over the `users` table, in-memory).
export interface UserRepository {
  nextId(): UserId
  findById(id: UserId): Promise<User | null>
  findByEmail(email: Email): Promise<User | null>
  existsByEmail(email: Email): Promise<boolean>
  save(user: User): Promise<void>
  delete(id: UserId): Promise<void>
}
