import { describe, it, expect } from 'vitest'
import { ok, Result } from '@/shared/kernel/Result'
import { JsonObject } from '@/shared/domain/Json'
import { CreateBoletoService } from '@/contexts/payments/application/use-cases/CreateBoletoService'
import {
  ResolveCredential,
  ResolveCredentialRequest,
} from '@/contexts/payments/application/ports/out/ResolveCredential'
import { StubBoletoProvider } from '@/contexts/payments/adapters/out/stub/StubBoletoProvider'
import { PaymentError } from '@/contexts/payments/domain/PaymentError'
import { Pagador } from '@/contexts/payments/domain/Pagador'

class StubResolveCredential implements ResolveCredential {
  readonly requests: ResolveCredentialRequest[] = []
  constructor(private readonly value: JsonObject | null) {}
  async resolve(req: ResolveCredentialRequest): Promise<Result<JsonObject | null>> {
    this.requests.push(req)
    return ok(this.value)
  }
}

// One Connect dialog stores auth AND beneficiário config in the same bag.
const CRED_BAG: JsonObject = {
  apiKey: 'key123',
  beneficiario: 'buenaca0101',
  codigoAcesso: 'senha',
  cooperativa: '0101',
  agencia: '11',
  codigoBeneficiario: '12345',
  ambiente: 'sandbox',
}

const PAGADOR: Pagador = {
  nome: 'Ana Cliente',
  cpfCnpj: '12345678909',
  endereco: {
    logradouro: 'Rua A',
    numero: '100',
    bairro: 'Centro',
    cidade: 'Porto Alegre',
    uf: 'RS',
    cep: '90000000',
  },
}

describe('CreateBoletoService', () => {
  it('resolves the Sicredi credential + beneficiário config from one bag and registers a boleto', async () => {
    const credentials = new StubResolveCredential(CRED_BAG)
    const provider = new StubBoletoProvider()
    const service = new CreateBoletoService(credentials, provider)

    const r = await service.execute({
      pagador: PAGADOR,
      valorCents: 14990,
      vencimento: '2026-07-15',
      seuNumero: 'PED-1',
    })

    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.valorCents).toBe(14990)
    expect(r.value.vencimento).toBe('2026-07-15')
    expect(r.value.status).toBe('registered')
    expect(r.value.linhaDigitavel).toBeTruthy()
    expect(r.value.codigoBarras).toBeTruthy()
    // hybrid boleto+PIX -> QR present.
    expect(r.value.pixQrCode).toBeDefined()
    // resolved by the "sicredi" plugin name.
    expect(credentials.requests[0]?.pluginName).toBe('sicredi')
    // the boleto reached the provider (deterministic stub).
    expect(provider.boletos.get(r.value.nossoNumero)?.pagador.nome).toBe('Ana Cliente')
  })

  it('fails with the "Sicredi não conectado" message when the credential is absent', async () => {
    const credentials = new StubResolveCredential(null)
    const provider = new StubBoletoProvider()
    const service = new CreateBoletoService(credentials, provider)

    const r = await service.execute({ pagador: PAGADOR, valorCents: 5000, vencimento: '2026-07-15' })

    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe(PaymentError.sicrediNotConnected)
    // never reached the provider.
    expect(provider.boletos.size).toBe(0)
  })

  it('fails with the "beneficiário incompleto" message when the config is incomplete', async () => {
    // auth present but missing codigoBeneficiario in the same bag.
    const incomplete: JsonObject = { ...CRED_BAG, codigoBeneficiario: '' }
    const credentials = new StubResolveCredential(incomplete)
    const provider = new StubBoletoProvider()
    const service = new CreateBoletoService(credentials, provider)

    const r = await service.execute({ pagador: PAGADOR, valorCents: 5000, vencimento: '2026-07-15' })

    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe(PaymentError.beneficiarioIncomplete)
    expect(provider.boletos.size).toBe(0)
  })
})
