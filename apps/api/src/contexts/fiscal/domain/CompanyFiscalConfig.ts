import { Result, ok, fail } from '@/shared/kernel/Result'
import { Ambiente, isAmbiente } from '@/contexts/fiscal/domain/Ambiente'
import { Emitente, RegimeTributario, isRegimeTributario } from '@/contexts/fiscal/domain/Emitente'
import { Endereco } from '@/contexts/fiscal/domain/Endereco'
import { FiscalError } from '@/contexts/fiscal/domain/FiscalError'

// The raw company fiscal config as read from the "nfe-certificate" credential bag
// (folded in alongside the A1 certificate, so one Connect dialog fully configures the
// emitente). Every field is an optional string (bag values are stringly-typed) so an
// incomplete config is representable and validated with a clear error rather than
// crashing. `extractCompanyFiscalConfig` fills this bag; the pure resolvers below
// turn it into a validated Emitente / Ambiente. Mirrors payments' SicrediRawConfig.
export interface CompanyFiscalConfig {
  readonly cnpj?: string
  readonly ie?: string
  readonly razaoSocial?: string
  // "1" | "2" | "3" (see RegimeTributario).
  readonly regime?: string
  readonly uf?: string
  // The emitente SEFAZ address, captured as flat fields in the credential bag.
  readonly logradouro?: string
  readonly numero?: string
  readonly bairro?: string
  readonly municipio?: string
  readonly cep?: string
  // 7-digit IBGE municipality code (optional here; the adapter needs it to emit).
  readonly codigoMunicipio?: string
  readonly ambiente?: string
  readonly csc?: string
  readonly cscId?: string
}

const nonEmpty = (v: string | undefined): v is string => typeof v === 'string' && v.trim().length > 0

// Build the emitente address from the flat config fields. Returns null when any
// required part is missing (the caller treats a null address as "incomplete"). The
// address UF is the emitente UF (one field in the credential bag). Pure.
const buildEndereco = (config: CompanyFiscalConfig): Endereco | null => {
  if (
    !nonEmpty(config.logradouro) ||
    !nonEmpty(config.numero) ||
    !nonEmpty(config.bairro) ||
    !nonEmpty(config.municipio) ||
    !nonEmpty(config.uf) ||
    !nonEmpty(config.cep)
  ) {
    return null
  }
  return {
    logradouro: config.logradouro.trim(),
    numero: config.numero.trim(),
    bairro: config.bairro.trim(),
    municipio: config.municipio.trim(),
    codigoMunicipio: nonEmpty(config.codigoMunicipio) ? config.codigoMunicipio.trim() : undefined,
    uf: config.uf.trim(),
    cep: config.cep.trim(),
  }
}

const parseRegime = (raw: string | undefined): RegimeTributario | null => {
  if (!nonEmpty(raw)) return null
  const n = Number(raw.trim())
  return isRegimeTributario(n) ? n : null
}

// Resolve the SEFAZ environment: explicit per-request override wins, else the
// configured default, else the safe 'homologacao' fallback (never live by accident).
export const resolveAmbiente = (
  config: CompanyFiscalConfig,
  override?: Ambiente,
): Ambiente => {
  if (override) return override
  if (isAmbiente(config.ambiente)) return config.ambiente
  return 'homologacao'
}

// Turn the raw config into a validated Emitente, or fail with the "incomplete"
// message. CSC/cscId are carried through when present (the NFC-e use-case enforces
// them). Pure: no I/O, deterministic.
export const resolveEmitente = (config: CompanyFiscalConfig): Result<Emitente> => {
  const regime = parseRegime(config.regime)
  const endereco = buildEndereco(config)
  if (
    !nonEmpty(config.cnpj) ||
    !nonEmpty(config.ie) ||
    !nonEmpty(config.razaoSocial) ||
    regime === null ||
    !nonEmpty(config.uf) ||
    endereco === null
  ) {
    return fail(FiscalError.companyConfigIncomplete)
  }
  return ok({
    cnpj: config.cnpj.trim(),
    ie: config.ie.trim(),
    razaoSocial: config.razaoSocial.trim(),
    regimeTributario: regime,
    endereco,
    uf: config.uf.trim(),
    csc: nonEmpty(config.csc) ? config.csc.trim() : undefined,
    cscId: nonEmpty(config.cscId) ? config.cscId.trim() : undefined,
  })
}
