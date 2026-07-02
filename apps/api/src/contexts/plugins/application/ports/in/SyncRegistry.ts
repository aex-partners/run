import { Result } from '@/shared/kernel/Result'

// Driving port. Source `plugins.syncRegistry`: upserts the bundled piece catalog
// into the plugins table (the "search/refresh registry" procedure), preserving
// install state on existing rows. Returns how many entries were synced.
export interface SyncRegistry {
  execute(): Promise<Result<{ synced: number }>>
}
