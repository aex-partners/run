// The outcome of a SEFAZ operation, normalized so the application and the AI never
// see SEFAZ's raw SOAP/XML vocabulary. `chave` is the 44-digit access key,
// `protocolo` the authorization/cancellation protocol number, `xml` the final
// (signed + protocol-stamped when available) document. The DANFE (printable PDF)
// is optional: node-sped-nfe emits XML only, so a URL/base64 is populated only when
// a rendering step is wired.
export type FiscalStatus = 'autorizado' | 'rejeitado' | 'cancelado' | 'pendente'

export interface FiscalResult {
  readonly chave: string
  readonly protocolo: string
  readonly status: FiscalStatus
  readonly xml: string
  readonly danfeUrl?: string
  readonly danfeBase64?: string
}
