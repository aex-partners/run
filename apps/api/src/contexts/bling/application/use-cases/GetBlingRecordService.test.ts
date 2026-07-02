import { describe, it, expect } from 'vitest'
import { ok, Result } from '@/shared/kernel/Result'
import { JsonObject } from '@/shared/domain/Json'
import { GetBlingRecordService } from '@/contexts/bling/application/use-cases/GetBlingRecordService'
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

describe('GetBlingRecordService', () => {
  it('reads a single contato back when Bling is connected', async () => {
    const credentials = new StubResolveCredential({ access_token: 'tok_123' })
    const client = new StubBlingClient({ contatos: [{ id: 7, nome: 'Acme Ltda' }] })
    const service = new GetBlingRecordService(credentials, client)

    const r = await service.execute({ resource: 'contatos', id: '7' })

    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value?.nome).toBe('Acme Ltda')
  })

  it('rejects an empty id as invalid input', async () => {
    const service = new GetBlingRecordService(
      new StubResolveCredential({ access_token: 'tok_123' }),
      new StubBlingClient(),
    )
    const r = await service.execute({ resource: 'contatos', id: '   ' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe(BlingError.invalidInput('id é obrigatório'))
  })

  it('fails with the "connect in Settings" message when the credential is null', async () => {
    const service = new GetBlingRecordService(new StubResolveCredential(null), new StubBlingClient())
    const r = await service.execute({ resource: 'contatos', id: '7' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe(BlingError.notConnected)
  })
})
