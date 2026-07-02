import { BlingSyncClient } from '@/contexts/bling/application/ports/out/BlingSyncClient'
import { ResolveCredential } from '@/contexts/bling/application/ports/out/ResolveCredential'
import { BLING_PLUGIN, extractAccessToken } from '@/contexts/bling/domain/blingCredential'
import { BlingError } from '@/contexts/bling/domain/BlingError'
import { BlingListResponse } from '@/contexts/bling/domain/mirror/BlingApiTypes'

const DEFAULT_BASE = 'https://www.bling.com.br/Api/v3'
const MIN_INTERVAL_MS = 350
const PAGE_SIZE = 100

// ACL out-port adapter for the Bling API v3, shaped for the full-mirror sync
// (bulk pagination + single-record fetch). Distinct from BlingApiV3Client (the
// per-resource ACL used by the read-through use-cases, which takes a token per
// call): this adapter owns transport concerns end-to-end -- throttling
// (Bling's ~3 req/s token bucket), 401 token-reload, 429 retry-after -- and
// resolves its own token from the injected credentials ResolveCredential
// out-port (never a direct DB/decrypt path; the credentials context
// auto-refreshes a near-expiry OAuth token before returning it). Ported from
// the old importer's client.ts transport shape. THROWS on transport/HTTP
// faults instead of returning a Result: the port signature returns raw `T` /
// an async iterable, and every call site is wrapped in the orchestrator's
// per-entity `guarded()` try/catch, so a thrown fault is contained to the
// entity being imported rather than aborting the whole sync.
export class BlingSyncApiV3Client implements BlingSyncClient {
  private lastCallAt = 0

  constructor(
    private readonly resolveCredential: ResolveCredential,
    private readonly base: string = process.env.BLING_BASE ?? DEFAULT_BASE,
  ) {}

  private async token(): Promise<string> {
    const resolved = await this.resolveCredential.resolve({ pluginName: BLING_PLUGIN })
    if (!resolved.ok) throw new Error(resolved.error)
    const token = extractAccessToken(resolved.value)
    if (!token) throw new Error(BlingError.notConnected)
    return token
  }

  private async throttle(): Promise<void> {
    const now = Date.now()
    const wait = Math.max(0, this.lastCallAt + MIN_INTERVAL_MS - now)
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))
    this.lastCallAt = Date.now()
  }

  async get<T>(path: string, retry = true): Promise<T> {
    await this.throttle()
    const token = await this.token()

    const res = await fetch(`${this.base}${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })

    // The credentials context auto-refreshes near-expiry tokens, but a 401 can
    // still surface (e.g. the token was revoked mid-sync) -- re-resolve once
    // and retry before giving up.
    if (res.status === 401 && retry) {
      return this.get<T>(path, false)
    }

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('retry-after') ?? '2')
      await new Promise((r) => setTimeout(r, retryAfter * 1000))
      return this.get<T>(path, retry)
    }

    if (!res.ok) {
      const body = await res.text()
      throw new Error(BlingError.provider(`${res.status} ${body.slice(0, 500)}`))
    }

    return (await res.json()) as T
  }

  // Iterate all pages of a list endpoint until a short/empty page. Bling's
  // default+max page size is 100; pages are 1-indexed.
  async *paginate<T>(path: string): AsyncIterable<T> {
    let pagina = 1
    while (true) {
      const sep = path.includes('?') ? '&' : '?'
      const params = new URLSearchParams({ pagina: String(pagina), limite: String(PAGE_SIZE) })
      const res = await this.get<BlingListResponse<T>>(`${path}${sep}${params}`)
      const items = res.data ?? []
      if (items.length === 0) return
      for (const item of items) yield item
      if (items.length < PAGE_SIZE) return
      pagina++
    }
  }
}
