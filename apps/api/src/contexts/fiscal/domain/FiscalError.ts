// Domain error vocabulary for the fiscal context. Failures travel as the shared
// `Result<T, string>` (matching the rest of the codebase); the message text is
// centralised here so the "not configured" guards read identically across the
// use-cases and the AI (Eric) always sees the same actionable, PT-BR sentence.
export type FiscalErrorCode =
  | 'certificate_not_configured'
  | 'company_config_incomplete'
  | 'csc_not_configured'
  | 'invalid_input'
  | 'provider_error'

export const FiscalError = {
  // Surfaced to Eric verbatim so he can tell the user to upload the A1 certificate.
  certificateNotConfigured:
    'Certificado fiscal não configurado. Configure em Settings.',
  // Missing/blank CNPJ, IE, regime or UF in the company fiscal settings.
  companyConfigIncomplete:
    'Dados fiscais da empresa incompletos (CNPJ/IE/regime/UF). Configure em Settings.',
  // NFC-e (modelo 65) additionally needs the CSC + cscId to sign the consumer QR.
  cscNotConfigured:
    'CSC e cscId não configurados. Necessários para emitir NFC-e. Configure em Settings.',
  invalidInput: (detail: string): string => `Entrada fiscal inválida: ${detail}`,
  provider: (detail: string): string => `Falha na emissão fiscal (SEFAZ): ${detail}`,
} as const
