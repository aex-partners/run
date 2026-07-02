import { Result, fail } from '@/shared/kernel/Result'
import {
  ListBlingResource,
  ListBlingResourceQuery,
} from '@/contexts/bling/application/ports/in/ListBlingResource'
import { BlingClient } from '@/contexts/bling/application/ports/out/BlingClient'
import { ResolveCredential } from '@/contexts/bling/application/ports/out/ResolveCredential'
import { BlingRecord } from '@/contexts/bling/domain/BlingRecord'
import { BLING_PLUGIN, extractAccessToken } from '@/contexts/bling/domain/blingCredential'
import { BlingError } from '@/contexts/bling/domain/BlingError'

// Application service. Resolve the Bling OAuth2 token (fail with the "connect in
// Settings" message when absent), then list the resource through the client. Pure
// orchestration: no HTTP here, the client owns transport.
export class ListBlingResourceService implements ListBlingResource {
  constructor(
    private readonly credentials: ResolveCredential,
    private readonly client: BlingClient,
  ) {}

  async execute(query: ListBlingResourceQuery): Promise<Result<{ items: BlingRecord[] }>> {
    const resolved = await this.credentials.resolve({ pluginName: BLING_PLUGIN })
    if (!resolved.ok) return fail(resolved.error)
    const token = extractAccessToken(resolved.value)
    if (!token) return fail(BlingError.notConnected)

    return this.client.list(token, query.resource, {
      pagina: query.pagina,
      limite: query.limite,
      pesquisa: query.pesquisa,
    })
  }
}
