import { describe, it, expect } from 'vitest'
import { ok, Result } from '@/shared/kernel/Result'
import { JsonObject } from '@/shared/domain/Json'
import { EmitNfceService } from '@/contexts/fiscal/application/use-cases/EmitNfceService'
import {
  ResolveCredential,
  ResolveCredentialRequest,
} from '@/contexts/fiscal/application/ports/out/ResolveCredential'
import { StubFiscalProvider } from '@/contexts/fiscal/adapters/out/stub/StubFiscalProvider'
import { FiscalError } from '@/contexts/fiscal/domain/FiscalError'
import { FiscalItem } from '@/contexts/fiscal/domain/FiscalItem'

class StubResolveCredential implements ResolveCredential {
  constructor(private readonly value: JsonObject | null) {}
  async resolve(_req: ResolveCredentialRequest): Promise<Result<JsonObject | null>> {
    return ok(this.value)
  }
}

// One "nfe-certificate" credential bag folding the A1 certificate + emitente fiscal
// config. Simples Nacional (regime 1) WITH CSC/cscId (required for NFC-e).
const BAG_WITH_CSC: JsonObject = {
  pfx: 'base64pfxdata',
  password: 'secret',
  razaoSocial: 'AEX Comercio LTDA',
  cnpj: '12345678000199',
  ie: '1234567890',
  regime: '1',
  uf: 'SP',
  logradouro: 'Av. Paulista',
  numero: '1000',
  bairro: 'Bela Vista',
  municipio: 'Sao Paulo',
  cep: '01310100',
  codigoMunicipio: '3550308',
  ambiente: 'homologacao',
  csc: 'ABCD1234EFGH5678',
  cscId: '000001',
}

const ITEM: FiscalItem = {
  descricao: 'Cafe expresso',
  ncm: '09011110',
  cfop: '5102',
  csosn: '102',
  origem: '0',
  unidade: 'UN',
  quantidade: 2,
  valorUnitario: 5,
  valorTotal: 10,
}

describe('EmitNfceService', () => {
  it('emits an anonymous NFC-e when CSC + cscId are configured', async () => {
    const credentials = new StubResolveCredential(BAG_WITH_CSC)
    const provider = new StubFiscalProvider()
    const service = new EmitNfceService(credentials, provider)

    const r = await service.execute({ items: [ITEM] })

    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.status).toBe('autorizado')
    const emitted = provider.emitted.get(r.value.chave)
    expect(emitted?.doc.model).toBe('nfce')
    // anonymous consumer (no cpfCnpj) when no destinatario is supplied.
    expect(emitted?.doc.destinatario.cpfCnpj).toBe('')
  })

  it('fails with the "CSC não configurado" message when CSC/cscId are missing', async () => {
    const { csc: _csc, cscId: _cscId, ...withoutCsc } = BAG_WITH_CSC
    const credentials = new StubResolveCredential(withoutCsc)
    const provider = new StubFiscalProvider()
    const service = new EmitNfceService(credentials, provider)

    const r = await service.execute({ items: [ITEM] })

    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe(FiscalError.cscNotConfigured)
    expect(provider.emitted.size).toBe(0)
  })

  it('fails with the "certificado não configurado" message when the certificate is absent', async () => {
    const credentials = new StubResolveCredential(null)
    const provider = new StubFiscalProvider()
    const service = new EmitNfceService(credentials, provider)

    const r = await service.execute({ items: [ITEM] })

    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe(FiscalError.certificateNotConfigured)
    expect(provider.emitted.size).toBe(0)
  })
})
