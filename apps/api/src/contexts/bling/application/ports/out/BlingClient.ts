import { Result } from '@/shared/kernel/Result'
import { BlingRecord } from '@/contexts/bling/domain/BlingRecord'
import { BlingResource } from '@/contexts/bling/domain/BlingResource'

// ACL out-port wrapping the external Bling API v3. Every method takes the
// already-resolved OAuth2 bearer `token` (the use-case fetches it from the
// credential store via the ResolveCredential ACL and passes it in, so the adapter
// stays stateless and the token is never hardcoded). All HTTP, path mapping and
// Bling quirks live in the adapter; the application sees only this port and never
// a thrown error — failures come back as `Result` failures.

// Common list filters. `pagina`/`limite` are Bling's global pagination params;
// `pesquisa` is a free-text search (honoured by /contatos; ignored by resources
// that don't support it). Only defined keys are sent.
export interface BlingListParams {
  pagina?: number
  limite?: number
  pesquisa?: string
}

export interface BlingClient {
  // List records of a resource. Reads Bling's `{ data: [...] }` envelope.
  list(
    token: string,
    resource: BlingResource,
    params: BlingListParams,
  ): Promise<Result<{ items: BlingRecord[] }>>

  // Fetch a single record by id. Returns null when Bling reports it as not found.
  get(token: string, resource: BlingResource, id: string): Promise<Result<BlingRecord | null>>
}
