import { Result, fail } from '@/shared/kernel/Result'
import {
  GetBlingRecord,
  GetBlingRecordQuery,
} from '@/contexts/bling/application/ports/in/GetBlingRecord'
import { BlingClient } from '@/contexts/bling/application/ports/out/BlingClient'
import { ResolveCredential } from '@/contexts/bling/application/ports/out/ResolveCredential'
import { BlingRecord } from '@/contexts/bling/domain/BlingRecord'
import { BLING_PLUGIN, extractAccessToken } from '@/contexts/bling/domain/blingCredential'
import { BlingError } from '@/contexts/bling/domain/BlingError'

// Application service. Resolve the Bling OAuth2 token (fail with the "connect in
// Settings" message when absent), then read a single record back from the client.
export class GetBlingRecordService implements GetBlingRecord {
  constructor(
    private readonly credentials: ResolveCredential,
    private readonly client: BlingClient,
  ) {}

  async execute(query: GetBlingRecordQuery): Promise<Result<BlingRecord | null>> {
    const id = query.id.trim()
    if (!id) return fail(BlingError.invalidInput('id é obrigatório'))

    const resolved = await this.credentials.resolve({ pluginName: BLING_PLUGIN })
    if (!resolved.ok) return fail(resolved.error)
    const token = extractAccessToken(resolved.value)
    if (!token) return fail(BlingError.notConnected)

    return this.client.get(token, query.resource, id)
  }
}
