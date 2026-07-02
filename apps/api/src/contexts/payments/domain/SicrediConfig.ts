import { Result, ok, fail } from '@/shared/kernel/Result'
import { PaymentError } from '@/contexts/payments/domain/PaymentError'

// The raw Sicredi beneficiário config, now extracted from the "sicredi" credential
// bag (folded in alongside the account auth, so one Connect dialog fully configures
// Sicredi). Every field is an optional string (bag values are stringly-typed) so an
// incomplete config is representable and validated with a clear error rather than
// crashing. `extractSicrediConfig` fills this bag; the pure resolver below turns it
// into a validated Beneficiario. Mirrors fiscal's CompanyFiscalConfig.
export interface SicrediRawConfig {
  // Sicredi cooperativa (4 digits).
  readonly cooperativa?: string
  // Sicredi agência / posto (2 digits).
  readonly agencia?: string
  // Código do beneficiário (cedente) at the cooperativa.
  readonly codigoBeneficiario?: string
  // 'sandbox' | 'producao' (see SicrediAmbiente); defaults to sandbox.
  readonly ambiente?: string
}

export type SicrediAmbiente = 'sandbox' | 'producao'

export const isSicrediAmbiente = (v: string | undefined): v is SicrediAmbiente =>
  v === 'sandbox' || v === 'producao'

// The validated beneficiário the BoletoProvider needs to register a boleto: the
// cooperativa/agência/código that identify the issuing account, plus the resolved
// environment.
export interface Beneficiario {
  readonly cooperativa: string
  readonly agencia: string
  readonly codigoBeneficiario: string
  readonly ambiente: SicrediAmbiente
}

const nonEmpty = (v: string | undefined): v is string => typeof v === 'string' && v.trim().length > 0

// Resolve the environment: the configured value when valid, else the safe 'sandbox'
// fallback (never live by accident). Pure.
export const resolveSicrediAmbiente = (config: SicrediRawConfig): SicrediAmbiente => {
  const raw = config.ambiente?.trim()
  return isSicrediAmbiente(raw) ? raw : 'sandbox'
}

// Turn the raw config into a validated Beneficiario, or fail with the "beneficiário
// incompleto" message when cooperativa/agência/código are missing. Pure: no I/O,
// deterministic.
export const resolveBeneficiario = (config: SicrediRawConfig): Result<Beneficiario> => {
  if (!nonEmpty(config.cooperativa) || !nonEmpty(config.agencia) || !nonEmpty(config.codigoBeneficiario)) {
    return fail(PaymentError.beneficiarioIncomplete)
  }
  return ok({
    cooperativa: config.cooperativa.trim(),
    agencia: config.agencia.trim(),
    codigoBeneficiario: config.codigoBeneficiario.trim(),
    ambiente: resolveSicrediAmbiente(config),
  })
}
