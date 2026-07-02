import { LoginAttempt } from '@/contexts/identity/domain/LoginAttempt'
import { Email } from '@/contexts/identity/domain/Email'

// Driven port for the lockout aggregate, keyed by normalized email. The
// load -> register -> save round-trip lives in the application service; clearing
// the row (reset / unlock) is a delete.
export interface LoginAttemptStore {
  find(email: Email): Promise<LoginAttempt | null>
  save(attempt: LoginAttempt): Promise<void>
  delete(email: Email): Promise<void>
}
