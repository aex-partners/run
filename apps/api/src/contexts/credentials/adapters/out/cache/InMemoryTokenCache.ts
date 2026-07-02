import { JsonObject } from '@/shared/domain/Json'
import { TokenCache } from '@/contexts/credentials/application/ports/out/TokenCache'

// Driven adapter for the TokenCache port. Module-free in-memory Map with a ~55s
// TTL (just under the typical 60s OAuth skew), ported from the source
// credential-resolver cache. Single-tenant: one process owns all credentials, so
// a plain Map is a safe cache (no cross-tenant leakage to guard against).
const TOKEN_CACHE_TTL_MS = 55_000

interface CachedToken {
  value: JsonObject
  expiresAtMs: number
}

export class InMemoryTokenCache implements TokenCache {
  private readonly entries = new Map<string, CachedToken>()

  constructor(private readonly ttlMs: number = TOKEN_CACHE_TTL_MS) {}

  get(id: string): JsonObject | null {
    const entry = this.entries.get(id)
    if (!entry) return null
    if (entry.expiresAtMs <= Date.now()) {
      this.entries.delete(id)
      return null
    }
    return entry.value
  }

  set(id: string, value: JsonObject): void {
    this.entries.set(id, { value, expiresAtMs: Date.now() + this.ttlMs })
  }

  invalidate(id: string): void {
    this.entries.delete(id)
  }

  clear(): void {
    this.entries.clear()
  }
}
