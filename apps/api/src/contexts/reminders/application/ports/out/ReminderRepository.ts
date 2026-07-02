import { Reminder } from '@/contexts/reminders/domain/Reminder'
import { ReminderId } from '@/contexts/reminders/domain/ids'

// Driven port. The application states WHAT it needs from persistence; an adapter
// under adapters/out implements HOW (Drizzle/Postgres, in-memory, etc.).
export interface ReminderRepository {
  nextId(): ReminderId
  findById(id: ReminderId): Promise<Reminder | null>
  save(reminder: Reminder): Promise<void>
}
