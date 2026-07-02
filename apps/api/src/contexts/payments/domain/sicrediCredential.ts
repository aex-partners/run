import { JsonObject } from '@/shared/domain/Json'
import { SicrediRawConfig } from '@/contexts/payments/domain/SicrediConfig'

// The credential store key under which the TENANT (the beneficiário, e.g. Buenaça)
// connects its Sicredi Cobrança account in Settings. The ResolveCredential ACL
// resolves the active credential for this plugin name (separate from the "pagseguro"
// plugin used by the charge flow).
//
// IMPORTANT — two credential layers (see docs / Sicredi Parceiros model):
//   * The APP registration (client_id + client_secret) belongs to AEX Run (the
//     software), registered ONCE on the Sicredi Developer Portal. It is PLATFORM
//     config read from env (SICREDI_CLIENT_ID / SICREDI_CLIENT_SECRET) — NOT here.
//   * This per-tenant bag holds only the BENEFICIÁRIO's own account auth, generated
//     by the account holder in their Sicredi Internet Banking, PLUS the beneficiário
//     identifiers (all captured in ONE Connect dialog, folding the former sicredi.*
//     settings into the credential bag):
//       { apiKey?, username?, password?, cooperativa?, agencia?, codigoBeneficiario?, ambiente? }
//       - apiKey    = "Chave de Acesso" (the x-api-key)
//       - username  = "Beneficiário + Cooperativa" (Sicredi's token username)
//       - password  = "Código de Acesso" (generated in Internet Banking)
//       - cooperativa/agencia/codigoBeneficiario = the beneficiário (cedente) issuing
//         the boleto; ambiente = 'sandbox' | 'producao' (defaults to sandbox)
// No live credential to validate against, so the adapter is best-effort (see
// SicrediBoletoProvider for the token-exchange assumptions).
export const SICREDI_PLUGIN = 'sicredi'

// The resolved per-tenant (beneficiário) Sicredi credential handed to the
// BoletoProvider. The app-level client_id/secret are injected separately from env.
export interface SicrediCredential {
  readonly apiKey?: string
  readonly username?: string
  readonly password?: string
}

// Aliases a "sicredi" credential bag might store each piece under, so resolution is
// tolerant of how the credential was saved in Settings. Pure: no I/O.
const API_KEY_KEYS = ['apiKey', 'api_key', 'x-api-key', 'xApiKey', 'chaveAcesso', 'chaveDeAcesso']
const USERNAME_KEYS = ['username', 'user', 'login', 'beneficiario']
const PASSWORD_KEYS = ['password', 'senha', 'secret', 'codigoAcesso', 'codigoDeAcesso']
// The beneficiário (cedente) identifiers, now stored in the SAME credential bag as
// the account auth (formerly the sicredi.* settings).
const COOPERATIVA_KEYS = ['cooperativa', 'coop']
const AGENCIA_KEYS = ['agencia', 'agência', 'posto']
const CODIGO_BENEFICIARIO_KEYS = ['codigoBeneficiario', 'codBeneficiario', 'codigoDoBeneficiario']
const AMBIENTE_KEYS = ['ambiente']

const firstString = (bag: JsonObject, keys: string[]): string | undefined => {
  for (const key of keys) {
    const v = bag[key]
    if (typeof v === 'string' && v.trim().length > 0) return v.trim()
  }
  return undefined
}

// Pull the Sicredi credential out of the decrypted credential bag. Returns null when
// Sicredi has NOT been connected — i.e. when the bag carries no usable auth material
// at all (no clientId, apiKey or username). The use-case turns that null into the
// actionable "Sicredi não conectado" failure. Pure: no I/O.
export const extractSicrediCredential = (bag: JsonObject | null): SicrediCredential | null => {
  if (!bag) return null
  const credential: SicrediCredential = {
    apiKey: firstString(bag, API_KEY_KEYS),
    username: firstString(bag, USERNAME_KEYS),
    password: firstString(bag, PASSWORD_KEYS),
  }
  // "Connected" means the beneficiário provided its account auth (Chave de Acesso
  // and/or Beneficiário+Cooperativa). Without any of these the adapter cannot
  // authenticate the account, so treat it as not connected.
  if (!credential.apiKey && !credential.username) return null
  return credential
}

// Pull the beneficiário (cedente) config out of the SAME decrypted credential bag,
// so a single Connect dialog fully configures Sicredi (auth + beneficiário). The
// pure resolveBeneficiario resolver validates completeness. Pure: no I/O.
export const extractSicrediConfig = (bag: JsonObject | null): SicrediRawConfig => {
  if (!bag) return {}
  return {
    cooperativa: firstString(bag, COOPERATIVA_KEYS),
    agencia: firstString(bag, AGENCIA_KEYS),
    codigoBeneficiario: firstString(bag, CODIGO_BENEFICIARIO_KEYS),
    ambiente: firstString(bag, AMBIENTE_KEYS),
  }
}
