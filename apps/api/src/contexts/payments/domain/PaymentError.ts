// Domain error vocabulary for the payments context. Failures still travel as the
// shared `Result<T, string>` (matching the rest of the codebase), but the message
// text is centralised here so the "not connected" guard reads identically across
// all three use-cases and the AI always sees the same actionable sentence.
export type PaymentErrorCode =
  | 'not_connected'
  | 'invalid_input'
  | 'provider_error'
  | 'sicredi_not_connected'
  | 'beneficiario_incomplete'
  | 'sicredi_provider_error'

export const PaymentError = {
  // Surfaced to Eric verbatim so he can tell the user to link PagSeguro.
  notConnected: 'PagSeguro not connected. Connect it in Settings first.',
  invalidInput: (detail: string): string => `Invalid payment input: ${detail}`,
  provider: (detail: string): string => `PagSeguro request failed: ${detail}`,

  // -- Sicredi boleto vocabulary (PT-BR, surfaced to Eric verbatim). ------------
  // No Sicredi credential connected in Settings.
  sicrediNotConnected: 'Sicredi não conectado. Configure as credenciais em Settings.',
  // Missing/blank cooperativa, agência or código do beneficiário in Settings.
  beneficiarioIncomplete:
    'Dados do beneficiário Sicredi incompletos (cooperativa/agência/código). Configure em Settings.',
  sicrediProvider: (detail: string): string => `Falha na requisição Sicredi: ${detail}`,
} as const
