import { describe, it, expect } from 'vitest'
import { ok, Result } from '@/shared/kernel/Result'
import { JsonObject } from '@/shared/domain/Json'
import { EmitNfeService } from '@/contexts/fiscal/application/use-cases/EmitNfeService'
import {
  ResolveCredential,
  ResolveCredentialRequest,
} from '@/contexts/fiscal/application/ports/out/ResolveCredential'
import { StubFiscalProvider } from '@/contexts/fiscal/adapters/out/stub/StubFiscalProvider'
import { FiscalError } from '@/contexts/fiscal/domain/FiscalError'
import { FiscalItem } from '@/contexts/fiscal/domain/FiscalItem'
import { Destinatario } from '@/contexts/fiscal/domain/Destinatario'

class StubResolveCredential implements ResolveCredential {
  readonly requests: ResolveCredentialRequest[] = []
  constructor(private readonly value: JsonObject | null) {}
  async resolve(req: ResolveCredentialRequest): Promise<Result<JsonObject | null>> {
    this.requests.push(req)
    return ok(this.value)
  }
}

// The whole fiscal setup now lives in ONE "nfe-certificate" credential bag: the A1
// certificate (pfx + password) AND the emitente fiscal config, folded together.
const FULL_BAG: JsonObject = {
  pfx: 'base64pfxdata',
  password: 'secret',
  razaoSocial: 'AEX Comercio LTDA',
  cnpj: '12345678000199',
  ie: '1234567890',
  regime: '3',
  uf: 'SP',
  logradouro: 'Av. Paulista',
  numero: '1000',
  bairro: 'Bela Vista',
  municipio: 'Sao Paulo',
  cep: '01310100',
  codigoMunicipio: '3550308',
  ambiente: 'homologacao',
}

const DEST: Destinatario = {
  nome: 'Cliente Teste',
  cpfCnpj: '98765432000188',
  endereco: {
    logradouro: 'Rua B',
    numero: '50',
    bairro: 'Centro',
    municipio: 'Sao Paulo',
    codigoMunicipio: '3550308',
    uf: 'SP',
    cep: '01000000',
  },
}

const ITEM: FiscalItem = {
  descricao: 'Servico de consultoria',
  ncm: '00000000',
  cfop: '5102',
  cst: '00',
  origem: '0',
  unidade: 'UN',
  quantidade: 1,
  valorUnitario: 100,
  valorTotal: 100,
}

describe('EmitNfeService', () => {
  it('resolves the certificate + company config from one bag and emits an NF-e', async () => {
    const credentials = new StubResolveCredential(FULL_BAG)
    const provider = new StubFiscalProvider()
    const service = new EmitNfeService(credentials, provider)

    const r = await service.execute({ destinatario: DEST, items: [ITEM] })

    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.status).toBe('autorizado')
    expect(r.value.chave).toHaveLength(44)
    expect(r.value.protocolo).toBeTruthy()
    // resolved by the "nfe-certificate" plugin name.
    expect(credentials.requests[0]?.pluginName).toBe('nfe-certificate')
    // the document reached the provider as an NF-e (modelo 55).
    expect(provider.emitted.get(r.value.chave)?.doc.model).toBe('nfe')
  })

  it('fails with the "certificado não configurado" message when the certificate is absent', async () => {
    const credentials = new StubResolveCredential(null)
    const provider = new StubFiscalProvider()
    const service = new EmitNfeService(credentials, provider)

    const r = await service.execute({ destinatario: DEST, items: [ITEM] })

    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe(FiscalError.certificateNotConfigured)
    // never reached the provider.
    expect(provider.emitted.size).toBe(0)
  })

  it('fails with the "dados fiscais incompletos" message when the company config is incomplete', async () => {
    // certificate present, but the bag is missing the CNPJ.
    const { cnpj: _cnpj, ...withoutCnpj } = FULL_BAG
    const credentials = new StubResolveCredential(withoutCnpj)
    const provider = new StubFiscalProvider()
    const service = new EmitNfeService(credentials, provider)

    const r = await service.execute({ destinatario: DEST, items: [ITEM] })

    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe(FiscalError.companyConfigIncomplete)
    expect(provider.emitted.size).toBe(0)
  })
})
