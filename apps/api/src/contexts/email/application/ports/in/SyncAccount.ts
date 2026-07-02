import { Result } from '@/shared/kernel/Result'

// Driving port behind emails.sync. Pulls new messages from IMAP and stores them.
// Also driven by the worker path after account creation.
export interface SyncAccountCommand {
  // The actor whose account scope is checked. Omitted for trusted (system)
  // callers such as the initial post-create sync.
  actorId?: string
  accountId: string
}

export interface SyncAccount {
  execute(cmd: SyncAccountCommand): Promise<Result<{ success: true; fetched: number; errors: number }>>
}
