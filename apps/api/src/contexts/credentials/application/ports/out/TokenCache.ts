import { JsonObject } from '@/shared/domain/Json'

// Driven port. A short-TTL (~55s) cache of decrypted OAuth values keyed by
// credential id, so a burst of piece invocations doesn't re-decrypt / re-refresh
// the same token. `invalidate` is called whenever a credential is mutated; the
// adapter (adapters/out/cache) is an in-memory Map (single-tenant: one process
// owns all credentials).
export interface TokenCache {
  get(id: string): JsonObject | null
  set(id: string, value: JsonObject): void
  invalidate(id: string): void
  clear(): void
}
