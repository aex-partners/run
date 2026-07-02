import { JsonObject } from '@/shared/domain/Json'
import { CompanyFiscalConfig } from '@/contexts/fiscal/domain/CompanyFiscalConfig'

// The credential store key under which the user connects the whole fiscal setup in
// one Connect dialog. The ResolveCredential ACL resolves the active credential for
// this plugin name. Its decrypted value bag folds the A1 certificate AND the company
// fiscal config into a single bag, e.g.:
//   {
//     pfx: "<base64 of the .pfx/.p12 file>", password: "<pfx password>",
//     razaoSocial, cnpj, ie, regime, uf,
//     logradouro, numero, bairro, municipio, cep, codigoMunicipio?,
//     ambiente, csc?, cscId?
//   }
// so one Connect fully configures NF-e / NFC-e emission end to end (mirrors the
// Sicredi credential bag, which folded the beneficiário config alongside the auth).
export const NFE_CERTIFICATE_PLUGIN = 'nfe-certificate'

// The resolved A1 certificate handed to the FiscalProvider: the PKCS#12 bytes as a
// base64 string plus its password. The adapter turns `pfx` back into a Buffer.
export interface Certificate {
  readonly pfx: string
  readonly password: string
}

// Aliases the "nfe-certificate" credential bag might store each piece under, so the
// resolution is tolerant of how the credential was saved. Pure: no I/O.
const PFX_KEYS = ['pfx', 'certificate', 'pfxBase64', 'p12', 'cert']
const PASSWORD_KEYS = ['password', 'senha', 'pfxPassword', 'passphrase', 'secret']

// The company fiscal config aliases, folded into the SAME bag as the certificate.
const RAZAO_SOCIAL_KEYS = ['razaoSocial', 'razao_social', 'razao', 'nomeEmpresarial']
const CNPJ_KEYS = ['cnpj']
const IE_KEYS = ['ie', 'inscricaoEstadual', 'inscricao_estadual']
const REGIME_KEYS = ['regime', 'regimeTributario', 'crt']
const UF_KEYS = ['uf', 'estado']
const LOGRADOURO_KEYS = ['logradouro', 'rua']
const NUMERO_KEYS = ['numero', 'nro', 'num']
const BAIRRO_KEYS = ['bairro']
const MUNICIPIO_KEYS = ['municipio', 'cidade']
const CEP_KEYS = ['cep']
const CODIGO_MUNICIPIO_KEYS = ['codigoMunicipio', 'codMunicipio', 'cMun', 'ibge']
const AMBIENTE_KEYS = ['ambiente']
const CSC_KEYS = ['csc', 'cscToken', 'codigoSeguranca']
const CSC_ID_KEYS = ['cscId', 'idCsc', 'cscid']

const firstString = (bag: JsonObject, keys: string[]): string | undefined => {
  for (const key of keys) {
    const v = bag[key]
    if (typeof v === 'string' && v.trim().length > 0) return v
  }
  return undefined
}

// Pull the { pfx, password } certificate out of the decrypted credential bag.
// Returns null when the certificate has not been connected (or lacks the pfx),
// which the use-case turns into the actionable "not configured" failure.
export const extractCertificate = (bag: JsonObject | null): Certificate | null => {
  if (!bag) return null
  const pfx = firstString(bag, PFX_KEYS)
  if (!pfx) return null
  const password = firstString(bag, PASSWORD_KEYS) ?? ''
  return { pfx, password }
}

// Pull the company fiscal config out of the SAME decrypted credential bag, so a
// single Connect dialog fully configures the emitente (certificate + fiscal data).
// The pure resolveEmitente / resolveAmbiente resolvers validate completeness. Pure:
// no I/O. Mirrors the Sicredi extractSicrediConfig.
export const extractCompanyFiscalConfig = (bag: JsonObject | null): CompanyFiscalConfig => {
  if (!bag) return {}
  return {
    razaoSocial: firstString(bag, RAZAO_SOCIAL_KEYS),
    cnpj: firstString(bag, CNPJ_KEYS),
    ie: firstString(bag, IE_KEYS),
    regime: firstString(bag, REGIME_KEYS),
    uf: firstString(bag, UF_KEYS),
    logradouro: firstString(bag, LOGRADOURO_KEYS),
    numero: firstString(bag, NUMERO_KEYS),
    bairro: firstString(bag, BAIRRO_KEYS),
    municipio: firstString(bag, MUNICIPIO_KEYS),
    cep: firstString(bag, CEP_KEYS),
    codigoMunicipio: firstString(bag, CODIGO_MUNICIPIO_KEYS),
    ambiente: firstString(bag, AMBIENTE_KEYS),
    csc: firstString(bag, CSC_KEYS),
    cscId: firstString(bag, CSC_ID_KEYS),
  }
}
