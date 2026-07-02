import { describe, it, expect } from 'vitest'
import { ok, Result } from '@/shared/kernel/Result'
import { JsonObject } from '@/shared/domain/Json'
import { ListBlingResourceService } from '@/contexts/bling/application/use-cases/ListBlingResourceService'
import {
  ResolveCredential,
  ResolveCredentialRequest,
} from '@/contexts/bling/application/ports/out/ResolveCredential'
import { StubBlingClient } from '@/contexts/bling/adapters/out/stub/StubBlingClient'
import { BlingError } from '@/contexts/bling/domain/BlingError'

class StubResolveCredential implements ResolveCredential {
  constructor(private readonly value: JsonObject | null) {}
  async resolve(_req: ResolveCredentialRequest): Promise<Result<JsonObject | null>> {
    return ok(this.value)
  }
}

describe('ListBlingResourceService', () => {
  it('lists produtos when Bling is connected', async () => {
    const credentials = new StubResolveCredential({ access_token: 'tok_123' })
    const client = new StubBlingClient({ produtos: [{ id: 42, nome: 'Caneta' }] })
    const service = new ListBlingResourceService(credentials, client)

    const r = await service.execute({ resource: 'produtos', pagina: 1, limite: 10 })

    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.items).toHaveLength(1)
    expect(r.value.items[0].nome).toBe('Caneta')
  })

  it('passes pesquisa through to the client', async () => {
    const credentials = new StubResolveCredential({ access_token: 'tok_123' })
    const client = new StubBlingClient()
    const service = new ListBlingResourceService(credentials, client)

    const r = await service.execute({ resource: 'contatos', pesquisa: 'Acme' })

    expect(r.ok).toBe(true)
    if (!r.ok) return
    // The stub echoes the pesquisa filter onto the first record.
    expect(r.value.items[0].pesquisa).toBe('Acme')
  })

  it('fails with the "connect in Settings" message when the credential is null', async () => {
    const service = new ListBlingResourceService(new StubResolveCredential(null), new StubBlingClient())
    const r = await service.execute({ resource: 'produtos' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe(BlingError.notConnected)
  })

  it('fails with the "connect in Settings" message when the bag has no access_token', async () => {
    const service = new ListBlingResourceService(
      new StubResolveCredential({ some_other_field: 'x' }),
      new StubBlingClient(),
    )
    const r = await service.execute({ resource: 'pedidos' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe(BlingError.notConnected)
  })
})
