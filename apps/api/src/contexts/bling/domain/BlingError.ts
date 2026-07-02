// Domain error vocabulary for the bling context. Failures travel as the shared
// `Result<T, string>` (like the rest of the codebase); the message text is
// centralised here so the "not connected" guard reads identically across both
// use-cases and the AI always sees the same actionable sentence.
export type BlingErrorCode = 'not_connected' | 'invalid_input' | 'provider_error'

export const BlingError = {
  // Surfaced to Eric verbatim so he tells the user to connect Bling in Settings.
  notConnected: 'Bling não conectado. Conecte o Bling em Settings.',
  invalidInput: (detail: string): string => `Entrada inválida para o Bling: ${detail}`,
  provider: (detail: string): string => `Falha na requisição ao Bling: ${detail}`,
} as const
