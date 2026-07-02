import { ok, fail, Result } from '@/shared/kernel/Result'
import { BlingClient, BlingListParams } from '@/contexts/bling/application/ports/out/BlingClient'
import { BlingRecord } from '@/contexts/bling/domain/BlingRecord'
import { BlingResource } from '@/contexts/bling/domain/BlingResource'
import { BlingError } from '@/contexts/bling/domain/BlingError'

// ACL adapter for the Bling API v3 (REST). Base URL comes from BLING_BASE,
// defaulting to the production host. Auth is an OAuth2 Bearer token passed in per
// call (resolved by the use-case from the encrypted credential store — never
// hardcoded; the credentials context auto-refreshes it). Every network/HTTP fault
// is caught and returned as a `Result` failure with a readable message; this
// adapter NEVER throws across the port. Reads Bling's `{ data: ... }` envelope.
const DEFAULT_BASE = 'https://www.bling.com.br/Api/v3'

// resource -> REST path. Verified against the Bling v3 OpenAPI: produtos live at
// /produtos, sales orders at /pedidos/vendas, contacts at /contatos.
const RESOURCE_PATH: Readonly<Record<BlingResource, string>> = {
  produtos: '/produtos',
  pedidos: '/pedidos/vendas',
  contatos: '/contatos',
}

// -- narrowing helpers (keep parsing `any`-free) -----------------------------
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)
const asString = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)

export class BlingApiV3Client implements BlingClient {
  constructor(private readonly base: string = process.env.BLING_BASE ?? DEFAULT_BASE) {}

  async list(
    token: string,
    resource: BlingResource,
    params: BlingListParams,
  ): Promise<Result<{ items: BlingRecord[] }>> {
    const res = await this.request(token, RESOURCE_PATH[resource], this.query(params))
    if (!res.ok) return res
    const data = res.value['data']
    const items = Array.isArray(data) ? data.filter(isRecord) : []
    return ok({ items: items as BlingRecord[] })
  }

  async get(
    token: string,
    resource: BlingResource,
    id: string,
  ): Promise<Result<BlingRecord | null>> {
    const res = await this.request(
      token,
      `${RESOURCE_PATH[resource]}/${encodeURIComponent(id)}`,
    )
    if (!res.ok) {
      // A 404 is a legitimate "not found", not a transport error.
      if (res.error.includes('404')) return ok(null)
      return res
    }
    const data = res.value['data']
    return ok(isRecord(data) ? (data as BlingRecord) : null)
  }

  // Serialise only defined params to Bling's query string. `pagina`/`limite` are
  // numbers; `pesquisa` is free text.
  private query(params: BlingListParams): Record<string, string> {
    const q: Record<string, string> = {}
    if (typeof params.pagina === 'number') q.pagina = String(params.pagina)
    if (typeof params.limite === 'number') q.limite = String(params.limite)
    if (typeof params.pesquisa === 'string' && params.pesquisa.trim().length > 0) {
      q.pesquisa = params.pesquisa.trim()
    }
    return q
  }

  // -- transport ---------------------------------------------------------------
  private async request(
    token: string,
    path: string,
    query: Record<string, string> = {},
  ): Promise<Result<Record<string, unknown>>> {
    try {
      const qs = Object.keys(query).length ? `?${new URLSearchParams(query)}` : ''
      const res = await fetch(`${this.base}${path}${qs}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      })
      const text = await res.text()
      let json: unknown = {}
      if (text) {
        try {
          json = JSON.parse(text)
        } catch {
          json = {}
        }
      }
      if (!res.ok) {
        return fail(BlingError.provider(`${res.status} ${this.readError(json) ?? text.slice(0, 300)}`))
      }
      return ok(isRecord(json) ? json : {})
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return fail(BlingError.provider(message))
    }
  }

  // Bling returns errors as { error: { type, message, description, fields: [...] } }.
  private readError(json: unknown): string | undefined {
    if (!isRecord(json)) return undefined
    const err = json['error']
    if (!isRecord(err)) return undefined
    return asString(err['description']) ?? asString(err['message']) ?? asString(err['type'])
  }
}
